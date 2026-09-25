import type { PlanId } from "@/generated/prisma/enums";

// The plans (docs/phase2/specs/A9-billing.md, section 1). Prices are monthly
// and in tomans. Changing a number here needs no migration.

export type PlanLimits = {
  /** Active products (isActive). Inactive ones don't count. */
  products: number;
  /** Order SMS to customers per Jalali month. */
  sms: number;
  /** People in the store, the owner included. */
  members: number;
  /** Signed-in devices: per member on paid plans, for the whole store on FREE (enforced with A10). */
  devicesPerMember: number;
};

export type Plan = { id: PlanId; name: string; monthlyPrice: number; limits: PlanLimits };

export const PLANS = {
  FREE: {
    id: "FREE",
    name: "رایگان",
    monthlyPrice: 0,
    limits: { products: 5, sms: 60, members: 1, devicesPerMember: 1 },
  },
  BASIC: {
    id: "BASIC",
    name: "پایه",
    monthlyPrice: 400_000,
    limits: { products: 10, sms: 400, members: 4, devicesPerMember: 2 },
  },
  GROWTH: {
    id: "GROWTH",
    name: "رشد",
    monthlyPrice: 1_100_000,
    limits: { products: 45, sms: 1_000, members: 7, devicesPerMember: 2 },
  },
  PRO: {
    id: "PRO",
    name: "حرفه‌ای",
    monthlyPrice: 2_200_000,
    limits: { products: 200, sms: 4_500, members: 20, devicesPerMember: 2 },
  },
} as const satisfies Record<Exclude<PlanId, "TRIAL">, Plan>;

/** Plans a seller can pay for, cheapest first. */
export const PAID_PLAN_IDS = ["BASIC", "GROWTH", "PRO"] as const;
export type PaidPlanId = (typeof PAID_PLAN_IDS)[number];

export function isPaidPlan(plan: string): plan is PaidPlanId {
  return (PAID_PLAN_IDS as readonly string[]).includes(plan);
}

/** The trial has the BASIC limits. */
export const TRIAL_LIMITS_PLAN: PaidPlanId = "BASIC";

/** Days after a paid period ends before the store falls back to FREE limits. The trial has none. */
export const GRACE_DAYS = 7;

/** The SUBSCRIPTION_REMINDER SMS goes out this many days before a period ends. */
export const REMINDER_DAYS_BEFORE_END = 3;
