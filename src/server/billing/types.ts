import type { PlanId, SubscriptionStatus } from "@/generated/prisma/enums";

// Contract for plan limits (docs/phase2/README.md, cross-track contracts).
// The real getPlanUsage/canUse (A9) and their stubs share these types.

/** Seller-side extras a plan can limit. Never used to refuse a customer's order (decision 3). */
export type PlanFeature = "extraSms" | "addMember";

export type CanUse = (sellerId: string, feature: PlanFeature) => Promise<boolean>;

/** `limit: null` means no limit. */
export type Quota = { used: number; limit: number | null };

export type PlanUsage = {
  plan: PlanId;
  status: SubscriptionStatus;
  currentPeriodEnd: Date;
  /** Orders in the current period. Shown only: orders are never limited (decision 3). */
  orders: number;
  /** Order SMS sent in the current period. */
  sms: Quota;
  members: Quota;
};

export type GetPlanUsage = (sellerId: string) => Promise<PlanUsage>;
