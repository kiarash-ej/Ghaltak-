import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { PlanId } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { PaymentGateway } from "@/server/payments/types";
import { billingEnabled } from "./config";
import { platformGateway } from "./platform-gateway";
import { PLANS, isPaidPlan, type PaidPlanId } from "./plans";
import { addJalaliMonth, effectivePlan } from "./state";

// Paying for a subscription month through the platform's gateway
// (docs/phase2/specs/A9-billing.md, section 6). The same shape as the order
// payment in B6 (src/server/payments/online-payment.ts):
//
//   "pay" -> startSubscriptionPayment: an OPEN Invoice with the plan's price
//     (never a form value) and a PENDING PaymentAttempt, then the gateway
//   gateway returns -> handleSubscriptionReturn:
//     1. verify with OUR amount; a transient failure keeps it PENDING
//     2. RECORD: PENDING -> VERIFIED, failureDetail NOT_APPLIED
//     3. APPLY once, in one transaction with the subscription row locked:
//        the invoice PAID and the period extended. A repeated return finds
//        nothing to claim and changes nothing.
//
// Which period a payment buys:
// - During a paid period (ACTIVE): the month after it, so paying early loses
//   nothing. Another plan starts then too (nextPlan).
// - Otherwise (trial, FREE, grace, fallen back): a month from now, at once.

export const NOT_APPLIED = "NOT_APPLIED";
/** A click within this window, for the same plan, reopens the same payment page. */
const REUSE_ATTEMPT_MINUTES = 10;

/** A failure the seller is told about; nothing sensitive in the message. */
export class SubscriptionPaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubscriptionPaymentError";
  }
}

type Opts = { gateway?: PaymentGateway | null; now?: () => Date };

export async function startSubscriptionPayment(
  sellerId: string,
  plan: string,
  opts: Opts & { origin: string },
): Promise<{ redirectUrl: string; attemptId: string }> {
  if (!billingEnabled()) throw new SubscriptionPaymentError("پرداخت اشتراک فعلاً فعال نیست.");
  if (!isPaidPlan(plan)) throw new SubscriptionPaymentError("پلن نامعتبر است.");
  const gateway = opts.gateway === undefined ? platformGateway() : opts.gateway;
  if (!gateway) throw new SubscriptionPaymentError("درگاه پرداخت اشتراک تنظیم نشده است.");
  const now = opts.now ?? (() => new Date());
  const amount = PLANS[plan].monthlyPrice;

  const decision = await prisma.$transaction(async (tx) => {
    const sub = await lockSubscription(tx, sellerId);
    const effective = effectivePlan(sub, now(), { billingEnabled: true });
    if (effective.nextPlan && effective.nextPlan !== plan) {
      throw new SubscriptionPaymentError(
        `تغییر به پلن ${PLANS[effective.nextPlan as PaidPlanId].name} از پایان دورهٔ فعلی ثبت شده است. تا آن زمان فقط تمدید همان پلن ممکن است.`,
      );
    }

    // A double click, the back button or a second tab reuse the open payment.
    const open = await tx.paymentAttempt.findFirst({
      where: {
        sellerId,
        status: "PENDING",
        authority: { not: null },
        invoice: { status: "OPEN", plan },
        createdAt: { gt: new Date(now().getTime() - REUSE_ATTEMPT_MINUTES * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, authority: true, amount: true, provider: true },
    });
    if (open?.authority && open.amount === amount && open.provider === gateway.provider) {
      return { reuse: { id: open.id, authority: open.authority } };
    }

    // Only one open invoice at a time; an older one is abandoned. (If its
    // payment still comes back verified, it is applied all the same.)
    await tx.invoice.updateMany({ where: { sellerId, status: "OPEN" }, data: { status: "VOID" } });
    const start = now();
    const invoice = await tx.invoice.create({
      data: { sellerId, plan, amount, periodStart: start, periodEnd: addJalaliMonth(start) },
      select: { id: true },
    });
    const attempt = await tx.paymentAttempt.create({
      data: { sellerId, invoiceId: invoice.id, provider: gateway.provider, amount },
      select: { id: true },
    });
    return { create: { attemptId: attempt.id, invoiceId: invoice.id } };
  });

  if ("reuse" in decision && decision.reuse) {
    return { redirectUrl: gateway.payUrl(decision.reuse.authority), attemptId: decision.reuse.id };
  }
  const { attemptId, invoiceId } = decision.create!;

  const seller = await prisma.seller.findUniqueOrThrow({ where: { id: sellerId }, select: { mobile: true } });
  const result = await gateway.request({
    amount,
    callbackUrl: `${opts.origin}/pay/subscription/${attemptId}`,
    description: `اشتراک ماهانهٔ پلن ${PLANS[plan].name} غلتک`,
    mobile: seller.mobile,
  });
  if (!result.ok) {
    await prisma.$transaction([
      prisma.paymentAttempt.update({
        where: { id: attemptId },
        data: { status: "FAILED", failureReason: "GATEWAY_ERROR", failureDetail: result.detail },
      }),
      prisma.invoice.updateMany({ where: { id: invoiceId, status: "OPEN" }, data: { status: "VOID" } }),
    ]);
    throw new SubscriptionPaymentError("اتصال به درگاه پرداخت برقرار نشد. کمی بعد دوباره تلاش کنید.");
  }
  await prisma.paymentAttempt.update({ where: { id: attemptId }, data: { authority: result.authority } });
  return { redirectUrl: result.redirectUrl, attemptId };
}

/**
 * paid      the invoice is paid and the subscription extended
 * pending   not settled yet (gateway unreachable, or recorded but not applied): refresh
 * canceled  canceled at the gateway
 * failed    the gateway said the payment did not go through
 * mismatch  the gateway verified a different amount: nothing is extended
 * invalid   not a real return for this attempt; nothing changed
 */
export type SubscriptionReturnOutcome = "paid" | "pending" | "canceled" | "failed" | "mismatch" | "invalid";

export async function handleSubscriptionReturn(
  input: { attemptId: string; authority: string | null; status: string | null },
  opts: Opts & { log?: (msg: string, data: object) => void } = {},
): Promise<SubscriptionReturnOutcome> {
  const now = opts.now ?? (() => new Date());
  const log = opts.log ?? ((msg, data) => console.error(msg, data));

  const attempt = await prisma.paymentAttempt.findUnique({
    where: { id: input.attemptId },
    select: { id: true, invoiceId: true, authority: true, amount: true, status: true, failureReason: true, failureDetail: true },
  });
  if (!attempt?.invoiceId) return "invalid";
  // Only with the gateway's own Authority, on every path (as for orders, #49).
  if (!input.authority || !attempt.authority || input.authority !== attempt.authority) return "invalid";

  let recorded = attempt.status === "VERIFIED";
  try {
    if (attempt.status !== "PENDING") {
      if (attempt.status === "VERIFIED" && attempt.failureDetail === NOT_APPLIED) {
        await applySubscriptionPayment(attempt.id, now);
      }
      return settled(attempt.id);
    }
    if (input.status !== "OK") {
      await prisma.paymentAttempt.updateMany({
        where: { id: attempt.id, status: "PENDING" },
        data: { status: "CANCELED", failureReason: "CANCELED_BY_USER" },
      });
      return "canceled";
    }

    // Verified even if billing was turned off meanwhile: the money is real.
    const gateway = opts.gateway === undefined ? platformGateway() : opts.gateway;
    if (!gateway) return "pending";
    const verified = await gateway.verify({ authority: attempt.authority, amount: attempt.amount });
    if (!verified.ok) {
      if (verified.transient) return "pending";
      await prisma.paymentAttempt.updateMany({
        where: { id: attempt.id, status: "PENDING" },
        data: {
          status: "FAILED",
          failureReason: verified.amountMismatch ? "AMOUNT_MISMATCH" : "GATEWAY_ERROR",
          failureDetail: verified.detail,
        },
      });
      return verified.amountMismatch ? "mismatch" : "failed";
    }

    await prisma.paymentAttempt.updateMany({
      where: { id: attempt.id, status: "PENDING" },
      data: {
        status: "VERIFIED",
        refId: verified.refId,
        cardPanMasked: verified.cardPanMasked,
        verifiedAt: now(),
        failureDetail: NOT_APPLIED,
      },
    });
    recorded = true;
    await applySubscriptionPayment(attempt.id, now);
    return settled(attempt.id);
  } catch (err) {
    const e = err as { name?: string; code?: string };
    log("[subscription payment return] failed", { attemptId: attempt.id, name: e?.name, code: e?.code });
    return recorded ? "pending" : "failed";
  }
}

/**
 * Payments the store started but never came back from (closed tab, gateway
 * outage): verified again when the billing page opens, so a paid month is
 * never lost. Only after STALE_MINUTES, when the gateway's payment page has
 * long expired: earlier, the seller may still be paying and a failed verify
 * would mark a payment in progress as failed. Returns how many got settled.
 */
export const STALE_MINUTES = 30;

export async function retryStalePendingPayments(sellerId: string, opts: Opts = {}): Promise<number> {
  const now = opts.now ?? (() => new Date());
  const stale = await prisma.paymentAttempt.findMany({
    where: {
      sellerId,
      invoiceId: { not: null },
      authority: { not: null },
      OR: [
        { status: "PENDING", createdAt: { lt: new Date(now().getTime() - STALE_MINUTES * 60 * 1000) } },
        { status: "VERIFIED", failureDetail: NOT_APPLIED },
      ],
      createdAt: { gt: new Date(now().getTime() - 7 * 24 * 60 * 60 * 1000) },
    },
    take: 5,
    select: { id: true, authority: true },
  });
  let done = 0;
  for (const a of stale) {
    const outcome = await handleSubscriptionReturn({ attemptId: a.id, authority: a.authority, status: "OK" }, opts);
    if (outcome !== "pending") done += 1;
  }
  return done;
}

async function lockSubscription(tx: Prisma.TransactionClient, sellerId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Subscription" WHERE "sellerId" = ${sellerId} FOR UPDATE`;
  return tx.subscription.findUniqueOrThrow({
    where: { sellerId },
    select: { plan: true, currentPeriodEnd: true, nextPlan: true, nextPlanFrom: true },
  });
}

/** Applies a VERIFIED, NOT_APPLIED payment once; a second call finds nothing to claim. */
async function applySubscriptionPayment(attemptId: string, now: () => Date): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.paymentAttempt.updateMany({
      where: { id: attemptId, status: "VERIFIED", failureDetail: NOT_APPLIED },
      data: { failureDetail: null },
    });
    if (claimed.count === 0) return;

    const attempt = await tx.paymentAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: { sellerId: true, amount: true, invoice: { select: { id: true, plan: true, amount: true, status: true } } },
    });
    const invoice = attempt.invoice!;
    if (invoice.status === "PAID" || attempt.amount !== invoice.amount) {
      // Can't happen with one attempt per invoice; kept visible for support.
      await tx.paymentAttempt.update({ where: { id: attemptId }, data: { failureDetail: `INVOICE_${invoice.status}` } });
      return;
    }

    const sub = await lockSubscription(tx, attempt.sellerId);
    const at = now();
    const effective = effectivePlan(sub, at, { billingEnabled: true });
    const bought: PlanId = invoice.plan;

    let data: Prisma.SubscriptionUpdateInput;
    let periodStart: Date;
    if (effective.state === "ACTIVE") {
      // The month after the current paid period.
      periodStart = sub.currentPeriodEnd;
      const change =
        effective.nextPlan !== null
          ? { nextPlan: bought } // the pending change's start stays the same
          : bought !== effective.plan
            ? { nextPlan: bought, nextPlanFrom: sub.currentPeriodEnd }
            : { nextPlan: null, nextPlanFrom: null };
      data = { plan: effective.plan, currentPeriodEnd: addJalaliMonth(periodStart), ...change };
    } else {
      periodStart = at;
      data = { plan: bought, currentPeriodEnd: addJalaliMonth(at), nextPlan: null, nextPlanFrom: null };
    }

    await tx.subscription.update({ where: { sellerId: attempt.sellerId }, data: { ...data, status: "ACTIVE" } });
    await tx.invoice.update({
      where: { id: invoice.id },
      data: { status: "PAID", paidAt: at, periodStart, periodEnd: data.currentPeriodEnd as Date },
    });
  });
}

async function settled(attemptId: string): Promise<SubscriptionReturnOutcome> {
  const a = await prisma.paymentAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    select: { status: true, failureReason: true, failureDetail: true },
  });
  switch (a.status) {
    case "CANCELED":
      return "canceled";
    case "FAILED":
      return a.failureReason === "AMOUNT_MISMATCH" ? "mismatch" : "failed";
    case "PENDING":
      return "pending";
    case "VERIFIED":
      return a.failureDetail === NOT_APPLIED ? "pending" : "paid";
  }
}
