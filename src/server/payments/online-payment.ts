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
//     amountDue() (or the same one again, if a recent one is still open), then
//     the gateway's payment page
//   gateway returns -> handleGatewayReturn:
//     1. verify with OUR amount. A transient failure (timeout, network) keeps
//        the attempt PENDING, so a refresh verifies again.
//     2. RECORD the verified payment on its own: PENDING -> VERIFIED with the
//        gateway's reference and failureDetail NOT_APPLIED. From here the money
//        is on record whatever happens next, and the seller sees it.
//     3. APPLY it in a separate transaction: NOT_APPLIED -> cleared (once),
//        and confirmPaymentInTx(ONLINE) only if the order still waits for
//        exactly that amount. If this step fails, NOT_APPLIED stays: the
//        seller sees «بررسی لازم», the order is not expired, and a refresh
//        (or the seller) finishes it.
//
// A verified payment that can't be applied (the order was canceled, already
// paid, or its amount changed) keeps VERIFIED with a failureDetail saying why:
// the seller refunds it or re-enters the order. Orders are never reopened.

/** failureDetail values on VERIFIED attempts: the seller must look at them. */
export const PAYMENT_NOTE = {
  /** Verified by the gateway, not yet applied to the order (step 3 pending or failed). */
  NOT_APPLIED: "NOT_APPLIED",
  /** The order's amount due changed while the customer was paying. */
  ORDER_AMOUNT_CHANGED: "ORDER_AMOUNT_CHANGED",
  /** The order no longer waited for payment, e.g. ORDER_WAS_CANCELED, ORDER_WAS_PAID. */
  orderWas: (status: string) => `ORDER_WAS_${status}`,
} as const;

/** A click within this window, for the same amount, reopens the same payment page. */
export const REUSE_ATTEMPT_MINUTES = 10;
/** An attempt still being set up (no authority yet) this recently means "wait". */
const IN_FLIGHT_SECONDS = 30;

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
  opts: { origin: string; gatewayFor?: GatewayFor; now?: () => Date },
): Promise<{ redirectUrl: string; attemptId: string }> {
  const gatewayFor = opts.gatewayFor ?? gatewayForSeller;
  const now = opts.now ?? (() => new Date());

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

  // One live payment page per order: a double click, the back button or a
  // second tab reuse the open attempt instead of creating a second payable
  // page. The order row lock makes simultaneous clicks take turns.
  const decision = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${order.id} FOR UPDATE`;
    const open = await tx.paymentAttempt.findFirst({
      where: {
        orderId: order.id,
        status: "PENDING",
        createdAt: { gt: new Date(now().getTime() - REUSE_ATTEMPT_MINUTES * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, authority: true, amount: true, provider: true, createdAt: true },
    });
    if (open && open.amount === amount && open.provider === gateway.provider) {
      if (open.authority) return { reuse: { id: open.id, authority: open.authority } };
      if (now().getTime() - open.createdAt.getTime() < IN_FLIGHT_SECONDS * 1000) return { wait: true as const };
    }
    const created = await tx.paymentAttempt.create({
      data: { sellerId: order.sellerId, orderId: order.id, provider: gateway.provider, amount },
      select: { id: true },
    });
    return { create: created.id };
  });

  if ("wait" in decision) {
    throw new OnlinePaymentError("درگاه پرداخت در حال آماده شدن است. چند ثانیه دیگر دوباره بزنید.");
  }
  if ("reuse" in decision && decision.reuse) {
    return { redirectUrl: gateway.payUrl(decision.reuse.authority), attemptId: decision.reuse.id };
  }
  const attemptId = decision.create!;

  const result = await gateway.request({
    amount,
    callbackUrl: `${opts.origin}/pay/callback/${attemptId}`,
    description: `سفارش ${orderCode(order.id)}`,
    mobile: order.customer.phone,
  });
  if (!result.ok) {
    await prisma.paymentAttempt.update({
      where: { id: attemptId },
      data: { status: "FAILED", failureReason: "GATEWAY_ERROR", failureDetail: result.detail },
    });
    throw new OnlinePaymentError("اتصال به درگاه پرداخت برقرار نشد. کمی بعد دوباره تلاش کنید.");
  }

  await prisma.paymentAttempt.update({ where: { id: attemptId }, data: { authority: result.authority } });
  return { redirectUrl: result.redirectUrl, attemptId };
}

/**
 * What happened, for the customer's order page:
 * paid       the order is now paid
 * pending    not settled yet (gateway unreachable, or recorded but not yet
 *            applied): refresh later; the money is safe either way
 * canceled   the customer canceled at the gateway
 * failed     the gateway said the payment did not go through
 * mismatch   money arrived but not for the order's current amount (seller checks)
 * late       money arrived but the order no longer waited for it (seller checks)
 * invalid    not a real return for this attempt; nothing changed
 */
export type ReturnOutcome = "paid" | "pending" | "canceled" | "failed" | "mismatch" | "late" | "invalid";

type ReturnResult = { outcome: ReturnOutcome; publicToken: string | null; orderId: string | null };

export async function handleGatewayReturn(
  input: { attemptId: string; authority: string | null; status: string | null },
  opts: { gatewayFor?: GatewayFor; now?: () => Date; log?: (msg: string, data: object) => void } = {},
): Promise<ReturnResult> {
  const gatewayFor = opts.gatewayFor ?? gatewayForSeller;
  const now = opts.now ?? (() => new Date());
  const log = opts.log ?? ((msg, data) => console.error(msg, data));

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
      order: { select: { publicToken: true } },
    },
  });
  const invalid: ReturnResult = { outcome: "invalid", publicToken: null, orderId: null };
  if (!attempt?.orderId || !attempt.order) return invalid;
  // The attempt id is in the gateway's return URL and the customer's history;
  // only with the gateway's own Authority does a return lead to the order
  // page, which shows the seller's card number while unpaid (#49). This holds
  // for a repeated return of a settled payment too.
  if (!input.authority || !attempt.authority || input.authority !== attempt.authority) return invalid;
  const orderId = attempt.orderId;
  const done = (outcome: ReturnOutcome): ReturnResult => ({
    outcome,
    publicToken: attempt.order!.publicToken,
    orderId,
  });

  // From here on the customer always goes back to their order page.
  let recorded = attempt.status === "VERIFIED";
  try {
    if (attempt.status !== "PENDING") {
      // Recorded earlier but not applied (a crash, a conflict): finish it now.
      if (attempt.status === "VERIFIED" && attempt.failureDetail === PAYMENT_NOTE.NOT_APPLIED) {
        return done((await applyVerifiedPayment(attempt.id, attempt.sellerId, orderId, now)) ?? (await settled(attempt.id)));
      }
      return done(settledOutcome(attempt)); // a repeated return: report, change nothing
    }
    if (input.status !== "OK") {
      await prisma.paymentAttempt.updateMany({
        where: { id: attempt.id, status: "PENDING" },
        data: { status: "CANCELED", failureReason: "CANCELED_BY_USER" },
      });
      return done("canceled");
    }

    const gateway = await gatewayFor(attempt.sellerId, { activeOnly: false });
    if (!gateway) return done("pending"); // left PENDING: it can be verified later

    const verified = await gateway.verify({ authority: attempt.authority, amount: attempt.amount });
    if (!verified.ok) {
      if (verified.transient) return done("pending"); // left PENDING: a refresh verifies again
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

    // Record first, on its own: the money is on record even if applying fails.
    await prisma.paymentAttempt.updateMany({
      where: { id: attempt.id, status: "PENDING" },
      data: {
        status: "VERIFIED",
        refId: verified.refId,
        cardPanMasked: verified.cardPanMasked,
        verifiedAt: now(),
        failureDetail: PAYMENT_NOTE.NOT_APPLIED,
      },
    });
    recorded = true;

    return done((await applyVerifiedPayment(attempt.id, attempt.sellerId, orderId, now)) ?? (await settled(attempt.id)));
  } catch (err) {
    const e = err as { name?: string; code?: string };
    log("[payment return] failed", { attemptId: attempt.id, name: e?.name, code: e?.code });
    return done(recorded ? "pending" : "failed");
  }
}

/**
 * Applies a VERIFIED, NOT_APPLIED payment to its order, once. Returns null if
 * another request already applied it. Throws (and leaves NOT_APPLIED) if the
 * transaction fails, e.g. the order changed at the same moment.
 */
async function applyVerifiedPayment(
  attemptId: string,
  sellerId: string,
  orderId: string,
  now: () => Date,
): Promise<ReturnOutcome | null> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.paymentAttempt.updateMany({
      where: { id: attemptId, status: "VERIFIED", failureDetail: PAYMENT_NOTE.NOT_APPLIED },
      data: { failureDetail: null },
    });
    if (claimed.count === 0) return null;

    const [attempt, order] = await Promise.all([
      tx.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId }, select: { amount: true } }),
      tx.order.findUniqueOrThrow({
        where: { id: orderId },
        select: { status: true, paidAt: true, receiptImageUrl: true, totalPrice: true, shippingCost: true },
      }),
    ]);

    if (order.status !== "PENDING_PAYMENT") {
      await tx.paymentAttempt.update({
        where: { id: attemptId },
        data: { failureReason: null, failureDetail: PAYMENT_NOTE.orderWas(order.status) },
      });
      return "late";
    }
    if (amountDue(order) !== attempt.amount) {
      await tx.paymentAttempt.update({
        where: { id: attemptId },
        data: { failureReason: "AMOUNT_MISMATCH", failureDetail: PAYMENT_NOTE.ORDER_AMOUNT_CHANGED },
      });
      return "mismatch";
    }

    await confirmPaymentInTx(tx, { sellerId, orderId, method: "ONLINE", paidAt: now() });
    return "paid";
  });
}

async function settled(attemptId: string): Promise<ReturnOutcome> {
  const a = await prisma.paymentAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    select: { status: true, failureReason: true, failureDetail: true },
  });
  return settledOutcome(a);
}

function settledOutcome(a: {
  status: "PENDING" | "VERIFIED" | "FAILED" | "CANCELED";
  failureReason: string | null;
  failureDetail: string | null;
}): ReturnOutcome {
  switch (a.status) {
    case "CANCELED":
      return "canceled";
    case "FAILED":
      return a.failureReason === "AMOUNT_MISMATCH" ? "mismatch" : "failed";
    case "PENDING":
      return "pending";
    case "VERIFIED":
      if (!a.failureDetail) return "paid";
      if (a.failureDetail === PAYMENT_NOTE.NOT_APPLIED) return "pending";
      return a.failureReason === "AMOUNT_MISMATCH" ? "mismatch" : "late";
  }
}
