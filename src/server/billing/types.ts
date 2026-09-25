import type { PlanId, SubscriptionStatus } from "@/generated/prisma/enums";
import type { EffectivePlan } from "./state";

// Contract for plan limits (docs/phase2/README.md, cross-track contracts),
// implemented by ./usage.ts (A9).

/** Seller-side extras a plan can limit. Never used to refuse a customer's order (decision 3). */
export type PlanFeature = "extraSms" | "addMember" | "addProduct";

export type CanUse = (sellerId: string, feature: PlanFeature) => Promise<boolean>;

/** `limit: null` means no limit. */
export type Quota = { used: number; limit: number | null };

export type PlanUsage = {
  plan: PlanId;
  status: SubscriptionStatus;
  currentPeriodEnd: Date;
  /** What the subscription allows right now (./state.ts). */
  effective: EffectivePlan;
  /** Orders this Jalali month. Shown only: orders are never limited (decision 3). */
  orders: number;
  /** Order SMS sent this Jalali month. */
  sms: Quota;
  members: Quota;
  /** Active products. */
  products: Quota;
};

export type GetPlanUsage = (sellerId: string) => Promise<PlanUsage>;
