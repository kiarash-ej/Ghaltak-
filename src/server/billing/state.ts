import type { PlanId } from "@/generated/prisma/enums";
import { APP_TIME_ZONE } from "@/lib/format";
import { GRACE_DAYS, TRIAL_LIMITS_PLAN } from "./plans";

// What a subscription allows right now, computed from its dates. Pure, no
// database. Nothing ever has to run at the end of a period for this to be
// right (docs/phase2/specs/A9-billing.md, section 2).

const DAY_MS = 24 * 60 * 60 * 1000;

export type SubscriptionDates = {
  plan: PlanId;
  currentPeriodEnd: Date;
  nextPlan: PlanId | null;
  nextPlanFrom: Date | null;
};

/**
 * TRIAL     the 14-day trial, BASIC limits
 * ACTIVE    a paid period
 * PAST_DUE  up to GRACE_DAYS after a paid period: same limits, with a warning
 * FREE      the free plan, or fallen back to it (trial over, grace over)
 */
export type EffectiveState = "TRIAL" | "ACTIVE" | "PAST_DUE" | "FREE";

export type EffectivePlan = {
  state: EffectiveState;
  /** The subscribed plan in force now (a pending change already applied once due). */
  plan: PlanId;
  /** Whose limits apply now. */
  limitsPlan: Exclude<PlanId, "TRIAL">;
  /** End of the trial or paid period; null on FREE. */
  periodEnd: Date | null;
  /** When PAST_DUE turns into FREE; null otherwise. */
  graceEndsAt: Date | null;
  /** A paid plan change still waiting for the current period to end. */
  nextPlan: PlanId | null;
  nextPlanFrom: Date | null;
  /** False while billing is off: limits are shown but never applied. */
  enforced: boolean;
};

export function effectivePlan(
  sub: SubscriptionDates,
  now: Date,
  opts: { billingEnabled: boolean },
): EffectivePlan {
  const switched = sub.nextPlan !== null && sub.nextPlanFrom !== null && now >= sub.nextPlanFrom;
  const plan = switched ? sub.nextPlan! : sub.plan;
  const base = {
    plan,
    nextPlan: switched ? null : sub.nextPlan,
    nextPlanFrom: switched ? null : sub.nextPlanFrom,
    enforced: opts.billingEnabled,
  };
  const free: EffectivePlan = { ...base, state: "FREE", limitsPlan: "FREE", periodEnd: null, graceEndsAt: null };
  const end = sub.currentPeriodEnd;

  if (plan === "FREE") return free;
  if (plan === "TRIAL") {
    if (opts.billingEnabled && now >= end) return free;
    return { ...base, state: "TRIAL", limitsPlan: TRIAL_LIMITS_PLAN, periodEnd: end, graceEndsAt: null };
  }
  if (!opts.billingEnabled || now < end) {
    return { ...base, state: "ACTIVE", limitsPlan: plan, periodEnd: end, graceEndsAt: null };
  }
  const graceEndsAt = new Date(end.getTime() + GRACE_DAYS * DAY_MS);
  if (now < graceEndsAt) return { ...base, state: "PAST_DUE", limitsPlan: plan, periodEnd: end, graceEndsAt };
  return free;
}

const jalaliParts = new Intl.DateTimeFormat("en-US-u-ca-persian", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

function jalali(d: Date): { year: number; month: number; day: number } {
  const p = Object.fromEntries(jalaliParts.formatToParts(d).map((x) => [x.type, x.value]));
  return { year: Number(p.year), month: Number(p.month), day: Number(p.day) };
}

/**
 * The same moment one Jalali month later (Tehran calendar): 3 Mehr -> 3 Aban.
 * A day the next month doesn't have becomes its last day (31 Shahrivar -> 30 Mehr).
 */
export function addJalaliMonth(from: Date): Date {
  const start = jalali(from);
  const target = start.month === 12 ? { year: start.year + 1, month: 1 } : { year: start.year, month: start.month + 1 };
  // One Jalali month is 28 to 31 days later; take the matching day, or the
  // last day of the target month when it is shorter.
  let best: Date | null = null;
  for (let days = 28; days <= 31; days++) {
    const candidate = new Date(from.getTime() + days * DAY_MS);
    const j = jalali(candidate);
    if (j.year !== target.year || j.month !== target.month || j.day > start.day) continue;
    best = candidate;
    if (j.day === start.day) break;
  }
  return best!;
}
