import "server-only";
import { prisma } from "@/lib/prisma";
import { amountDue, paymentState } from "@/server/orders/payment";
import { confirmPaymentInTx } from "@/server/orders/payment-store";
import { orderCode } from "@/server/orders/queries";
import { gatewayForSeller } from "./gateway-store";
import type { PaymentGateway } from "./types";

// Online payment of an order through the seller's own gateway (Phase 2, B6).
//
//   customer "pay online" -> startOnlinePayment: a PENDING PaymentAttempt for
//     amountDue(), then the gateway's payment page
//   gateway returns -> handleGatewayReturn: verify with OUR amount, then in
//     ONE transaction attempt PENDING -> VERIFIED (once) and, if the order
//     still waits for exactly that amount, confirmPaymentInTx(method ONLINE)
//
// A verified payment that could NOT be applied to its order (the order was
// canceled or expired meanwhile, already paid, or its amount changed) keeps
// status VERIFIED and gets a failureDetail: the money arrived, the seller must
// look at it (refund, or re-enter the order by hand). The order is never
// reopened automatically, since its stock may be sold by now.

type GatewayFor = (sellerId: string, opts?: { activeOnly?: boolean }) => Promise<PaymentGateway | null>;

/** A failure the customer is told about; nothing sensitive in the message. */
export class OnlinePaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OnlinePaymentError";
  }
}

export async function startOnlinePayment(
  publicToken: string,
  opts: { origin: string; gatewayFor?: GatewayFor },
): Promise<{ redirectUrl: string; attemptId: string }> {
  const gatewayFor = opts.gatewayFor ?? gatewayForSeller;
  const order = await prisma.order.findUnique({
    where: { publicToken },
    select: {
      id: true,
      sellerId: true,
      status: true,
      paidAt: true,
      receiptImageUrl: true,
      totalPrice: true,
      shippingCost: true,
      customer: { select: { phone: true } },
    },
  });
  if (!order) throw new OnlinePaymentError("سفارش پیدا نشد.");

  const state = paymentState(order);
  if (state === "RECEIPT_SUBMITTED") {
    throw new OnlinePaymentError("رسید کارت‌به‌کارت شما در انتظار بررسی فروشنده است.");
  }
  if (state !== "UNPAID") throw new OnlinePaymentError("این سفارش منتظر پرداخت نیست.");

  const gateway = await gatewayFor(order.sellerId);
  if (!gateway) throw new OnlinePaymentError("پرداخت آنلاین برای این فروشگاه فعال نیست.");

  const amount = amountDue(order);
  const attempt = await prisma.paymentAttempt.create({
    data: { sellerId: order.sellerId, orderId: order.id, provider: gateway.provider, amount },
    select: { id: true },
  });

  const result = await gateway.request({
    amount,
    callbackUrl: `${opts.origin}/pay/callback/${attempt.id}`,
    description: `سفارش ${orderCode(order.id)}`,
    mobile: order.customer.phone,
  });
  if (!result.ok) {
    await prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: { status: "FAILED", failureReason: "GATEWAY_ERROR", failureDetail: result.detail },
    });
    throw new OnlinePaymentError("اتصال به درگاه پرداخت برقرار نشد. کمی بعد دوباره تلاش کنید.");
  }

  await prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { authority: result.authority } });
  return { redirectUrl: result.redirectUrl, attemptId: attempt.id };
}

/**
 * What happened, for the customer's order page:
 * paid       the order is now paid
 * canceled   the customer canceled at the gateway
 * failed     the gateway did not confirm the payment
 * mismatch   money arrived but not for the order's current amount (seller checks)
 * late       money arrived but the order no longer waited for it (seller checks)
 * invalid    not a real return for this attempt; nothing changed
 */
export type ReturnOutcome = "paid" | "canceled" | "failed" | "mismatch" | "late" | "invalid";

export async function handleGatewayReturn(
  input: { attemptId: string; authority: string | null; status: string | null },
  opts: { gatewayFor?: GatewayFor; now?: () => Date } = {},
): Promise<{ outcome: ReturnOutcome; publicToken: string | null; orderId: string | null }> {
  const gatewayFor = opts.gatewayFor ?? gatewayForSeller;
  const now = opts.now ?? (() => new Date());

  const attempt = await prisma.paymentAttempt.findUnique({
    where: { id: input.attemptId },
    select: {
      id: true,
      sellerId: true,
      orderId: true,
      authority: true,
      amount: true,
      status: true,
      failureReason: true,
      failureDetail: true,
      order: { select: { publicToken: true, status: true } },
    },
  });
  if (!attempt?.orderId || !attempt.order) return { outcome: "invalid", publicToken: null, orderId: null };
  const done = (outcome: ReturnOutcome) => ({
    outcome,
    publicToken: attempt.order!.publicToken,
    orderId: attempt.orderId,
  });

  // A repeated return (refresh, back button): report, change nothing.
  if (attempt.status !== "PENDING") return done(settledOutcome(attempt));
  if (!input.authority || input.authority !== attempt.authority) return done("invalid");

  if (input.status !== "OK") {
    await prisma.paymentAttempt.updateMany({
      where: { id: attempt.id, status: "PENDING" },
      data: { status: "CANCELED", failureReason: "CANCELED_BY_USER" },
    });
    return done("canceled");
  }

  const gateway = await gatewayFor(attempt.sellerId, { activeOnly: false });
  if (!gateway) return done("failed"); // left PENDING: it can still be verified later

  const verified = await gateway.verify({ authority: input.authority, amount: attempt.amount });
  if (!verified.ok) {
    await prisma.paymentAttempt.updateMany({
      where: { id: attempt.id, status: "PENDING" },
      data: {
        status: "FAILED",
        failureReason: verified.amountMismatch ? "AMOUNT_MISMATCH" : "GATEWAY_ERROR",
        failureDetail: verified.detail,
      },
    });
    return done(verified.amountMismatch ? "mismatch" : "failed");
  }

  const outcome = await prisma.$transaction(async (tx): Promise<ReturnOutcome | null> => {
    // Only one return can move the attempt out of PENDING, so the order is
    // confirmed (and later texted) at most once.
    const claimed = await tx.paymentAttempt.updateMany({
      where: { id: attempt.id, status: "PENDING" },
      data: {
        status: "VERIFIED",
        refId: verified.refId,
        cardPanMasked: verified.cardPanMasked,
        verifiedAt: now(),
      },
    });
    if (claimed.count === 0) return null;

    const order = await tx.order.findUniqueOrThrow({
      where: { id: attempt.orderId! },
      select: { status: true, paidAt: true, receiptImageUrl: true, totalPrice: true, shippingCost: true },
    });
    if (order.status !== "PENDING_PAYMENT") {
      await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          failureReason: order.status === "CANCELED" ? "EXPIRED" : null,
          failureDetail: `order was ${order.status} when the payment arrived`,
        },
      });
      return "late";
    }
    if (amountDue(order) !== attempt.amount) {
      await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: { failureReason: "AMOUNT_MISMATCH", failureDetail: "the order's amount changed during payment" },
      });
      return "mismatch";
    }

    await confirmPaymentInTx(tx, {
      sellerId: attempt.sellerId,
      orderId: attempt.orderId!,
      method: "ONLINE",
      paidAt: now(),
    });
    return "paid";
  });

  if (outcome) return done(outcome);
  // Another return finished first; report what it settled on.
  const settled = await prisma.paymentAttempt.findUniqueOrThrow({
    where: { id: attempt.id },
    select: { status: true, failureReason: true, failureDetail: true, order: { select: { status: true } } },
  });
  return done(settledOutcome({ ...settled, order: settled.order }));
}

function settledOutcome(a: {
  status: "PENDING" | "VERIFIED" | "FAILED" | "CANCELED";
  failureReason: string | null;
  failureDetail: string | null;
  order: { status: string } | null;
}): ReturnOutcome {
  if (a.status === "CANCELED") return "canceled";
  if (a.status === "FAILED") return a.failureReason === "AMOUNT_MISMATCH" ? "mismatch" : "failed";
  if (a.status === "VERIFIED") {
    if (!a.failureDetail) return "paid";
    return a.failureReason === "AMOUNT_MISMATCH" ? "mismatch" : "late";
  }
  return "failed";
}
