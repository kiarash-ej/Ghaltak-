import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { reportPeriods } from "@/server/reports/periods";
import { countSmsThisMonth } from "@/server/sms/usage";
import { billingEnabled } from "./config";
import { PLANS } from "./plans";
import { effectivePlan, type EffectivePlan, type SubscriptionDates } from "./state";
import type { CanUse, GetPlanUsage, PlanFeature } from "./types";

// Plan limits (docs/phase2/specs/A9-billing.md, section 3). Contract for
// Track B: ./types.ts. Orders are never limited here or anywhere (decision 3).

type Db = Prisma.TransactionClient | typeof prisma;

const subscriptionSelect = {
  plan: true,
  status: true,
  currentPeriodEnd: true,
  nextPlan: true,
  nextPlanFrom: true,
} as const;

/**
 * Every store has a subscription (ensureSellerAccount, and the Step 0
 * backfill). One missing is a bug: it gets the FREE limits, never unlimited.
 */
function missingSubscription(sellerId: string): SubscriptionDates & { status: "CANCELED" } {
  console.error("[billing] store without a subscription", { sellerId });
  return { plan: "FREE", status: "CANCELED", currentPeriodEnd: new Date(0), nextPlan: null, nextPlanFrom: null };
}

async function effectiveFor(db: Db, sellerId: string, now: Date): Promise<EffectivePlan> {
  const sub =
    (await db.subscription.findUnique({ where: { sellerId }, select: subscriptionSelect })) ??
    missingSubscription(sellerId);
  return effectivePlan(sub, now, { billingEnabled: billingEnabled() });
}

/** What the store's subscription allows right now, and its stored plan. */
export async function getEffectivePlan(sellerId: string, now: Date = new Date()) {
  const sub =
    (await prisma.subscription.findUnique({ where: { sellerId }, select: subscriptionSelect })) ??
    missingSubscription(sellerId);
  return { stored: sub, effective: effectivePlan(sub, now, { billingEnabled: billingEnabled() }) };
}

function countActiveProducts(db: Db, sellerId: string, excludeProductId?: string) {
  return db.product.count({
    where: { sellerId, isActive: true, ...(excludeProductId ? { id: { not: excludeProductId } } : {}) },
  });
}

export const getPlanUsage: GetPlanUsage = async (sellerId) => {
  const now = new Date();
  const sub =
    (await prisma.subscription.findUnique({ where: { sellerId }, select: subscriptionSelect })) ??
    missingSubscription(sellerId);
  const effective = effectivePlan(sub, now, { billingEnabled: billingEnabled() });
  const limits = PLANS[effective.limitsPlan].limits;

  const [orders, sms, members, products] = await Promise.all([
    prisma.order.count({ where: { sellerId, createdAt: { gte: reportPeriods(now).month } } }),
    countSmsThisMonth(sellerId, now),
    prisma.membership.count({ where: { sellerId } }),
    countActiveProducts(prisma, sellerId),
  ]);

  return {
    plan: sub.plan,
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd,
    effective,
    orders,
    sms: { used: sms, limit: limits.sms },
    members: { used: members, limit: limits.members },
    products: { used: products, limit: limits.products },
  };
};

export const canUse: CanUse = async (sellerId, feature: PlanFeature) => {
  const effective = await effectiveFor(prisma, sellerId, new Date());
  if (!effective.enforced) return true;
  const limits = PLANS[effective.limitsPlan].limits;
  switch (feature) {
    case "extraSms":
      return (await countSmsThisMonth(sellerId)) < limits.sms;
    case "addMember":
      return (await prisma.membership.count({ where: { sellerId } })) < limits.members;
    case "addProduct":
      return (await countActiveProducts(prisma, sellerId)) < limits.products;
  }
};

/**
 * canUse("addProduct") inside the transaction that creates or activates a
 * product. Locks the store's subscription row first, so two saves at the same
 * moment take turns and can't both take the last free slot.
 * `excludeProductId`: the product being activated, not counted as already active.
 */
export async function hasProductSlotInTx(
  tx: Prisma.TransactionClient,
  sellerId: string,
  opts: { excludeProductId?: string; now?: Date } = {},
): Promise<boolean> {
  await tx.$queryRaw`SELECT "id" FROM "Subscription" WHERE "sellerId" = ${sellerId} FOR UPDATE`;
  const effective = await effectiveFor(tx, sellerId, opts.now ?? new Date());
  if (!effective.enforced) return true;
  const active = await countActiveProducts(tx, sellerId, opts.excludeProductId);
  return active < PLANS[effective.limitsPlan].limits.products;
}

/**
 * canUse("addMember") inside the transaction that adds the member, with the
 * store's subscription row locked, so two invitations at once can't both take
 * the last place (A10).
 */
export async function hasMemberSlotInTx(
  tx: Prisma.TransactionClient,
  sellerId: string,
  opts: { now?: Date } = {},
): Promise<boolean> {
  await tx.$queryRaw`SELECT "id" FROM "Subscription" WHERE "sellerId" = ${sellerId} FOR UPDATE`;
  const effective = await effectiveFor(tx, sellerId, opts.now ?? new Date());
  if (!effective.enforced) return true;
  const members = await tx.membership.count({ where: { sellerId } });
  return members < PLANS[effective.limitsPlan].limits.members;
}
