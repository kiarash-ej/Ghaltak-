import { describe, expect, it } from "vitest";
import { subscriptionBanner } from "./banner";
import { effectivePlan, type SubscriptionDates } from "./state";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-01T08:00:00Z");
const sub = (plan: SubscriptionDates["plan"], endInDays: number): SubscriptionDates => ({
  plan,
  currentPeriodEnd: new Date(now.getTime() + endInDays * DAY),
  nextPlan: null,
  nextPlanFrom: null,
});
const banner = (s: SubscriptionDates, billingEnabled = true) =>
  subscriptionBanner(s.plan, effectivePlan(s, now, { billingEnabled }), now);

describe("subscriptionBanner", () => {
  it("nothing far from the end, on FREE by choice, or with billing off", () => {
    expect(banner(sub("BASIC", 10))).toBeNull();
    expect(banner(sub("FREE", -100))).toBeNull();
    expect(banner(sub("TRIAL", -5), false)).toBeNull();
  });

  it("warns within 3 days of the end", () => {
    expect(banner(sub("TRIAL", 2))).toMatchObject({ tone: "warning" });
    expect(banner(sub("PRO", 1))?.text).toContain("اشتراک");
  });

  it("past due, then fallen to FREE", () => {
    expect(banner(sub("BASIC", -2))).toMatchObject({ tone: "danger" });
    expect(banner(sub("BASIC", -2))?.text).toContain("تمدید");
    expect(banner(sub("BASIC", -8))?.text).toContain("رایگان");
    expect(banner(sub("TRIAL", -1))?.text).toContain("دورهٔ آزمایشی تمام شد");
  });
});
