import "server-only";
import { prisma } from "@/lib/prisma";
import type { GetPlanUsage } from "./types";

/**
 * TEMPORARY STUB of getPlanUsage (Phase 2 Step 0): the real subscription, but
 * no counting and no limits until A9 adds plans with the same type. Switching
 * is a one-line import change.
 */
export const getPlanUsage: GetPlanUsage = async (sellerId) => {
  const sub = await prisma.subscription.findUniqueOrThrow({ where: { sellerId } });
  return {
    plan: sub.plan,
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd,
    orders: 0,
    sms: { used: 0, limit: null },
    members: { used: 1, limit: null },
  };
};
