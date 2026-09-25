import { describe, expect, it } from "vitest";
import { addJalaliMonth, effectivePlan, type SubscriptionDates } from "./state";

const DAY = 24 * 60 * 60 * 1000;
const end = new Date("2026-10-10T08:00:00Z");
const on = { billingEnabled: true };

function sub(plan: SubscriptionDates["plan"], extra: Partial<SubscriptionDates> = {}): SubscriptionDates {
  return { plan, currentPeriodEnd: end, nextPlan: null, nextPlanFrom: null, ...extra };
}
const at = (ms: number) => new Date(end.getTime() + ms);

describe("effectivePlan (billing on)", () => {
  it("trial: BASIC limits until the end, then FREE with no grace", () => {
    expect(effectivePlan(sub("TRIAL"), at(-1), on)).toMatchObject({ state: "TRIAL", limitsPlan: "BASIC", enforced: true });
    expect(effectivePlan(sub("TRIAL"), at(0), on)).toMatchObject({ state: "FREE", limitsPlan: "FREE" });
  });

  it("paid: its own limits, then 7 days PAST_DUE with the same limits, then FREE", () => {
    expect(effectivePlan(sub("PRO"), at(-1), on)).toMatchObject({ state: "ACTIVE", limitsPlan: "PRO", graceEndsAt: null });
    expect(effectivePlan(sub("PRO"), at(0), on)).toMatchObject({
      state: "PAST_DUE",
      limitsPlan: "PRO",
      graceEndsAt: at(7 * DAY),
    });
    expect(effectivePlan(sub("PRO"), at(7 * DAY - 1), on)).toMatchObject({ state: "PAST_DUE" });
    expect(effectivePlan(sub("PRO"), at(7 * DAY), on)).toMatchObject({ state: "FREE", limitsPlan: "FREE" });
  });

  it("FREE is always FREE", () => {
    expect(effectivePlan(sub("FREE"), at(-10 * DAY), on)).toMatchObject({ state: "FREE", limitsPlan: "FREE", periodEnd: null });
  });

  it("a pending plan change takes over from nextPlanFrom", () => {
    const s = sub("BASIC", { currentPeriodEnd: at(30 * DAY), nextPlan: "PRO", nextPlanFrom: end });
    expect(effectivePlan(s, at(-1), on)).toMatchObject({ plan: "BASIC", limitsPlan: "BASIC", nextPlan: "PRO" });
    expect(effectivePlan(s, at(0), on)).toMatchObject({ plan: "PRO", limitsPlan: "PRO", nextPlan: null });
  });
});

describe("effectivePlan (billing off)", () => {
  const off = { billingEnabled: false };
  it("nothing expires and nothing is enforced", () => {
    expect(effectivePlan(sub("TRIAL"), at(100 * DAY), off)).toMatchObject({ state: "TRIAL", limitsPlan: "BASIC", enforced: false });
    expect(effectivePlan(sub("BASIC"), at(100 * DAY), off)).toMatchObject({ state: "ACTIVE", limitsPlan: "BASIC", enforced: false });
  });
});

describe("addJalaliMonth (Tehran)", () => {
  // Formatted as the Jalali date in Tehran, to check against the calendar.
  const jalali = (d: Date) =>
    new Intl.DateTimeFormat("en-US-u-ca-persian", {
      timeZone: "Asia/Tehran",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).format(d);

  it("keeps the day of the month and the time", () => {
    const from = new Date("2026-09-25T10:30:00Z"); // 3 Mehr 1405
    const to = addJalaliMonth(from);
    expect(jalali(from)).toBe("7/3/1405 AP");
    expect(jalali(to)).toBe("8/3/1405 AP");
    expect(to.getUTCHours()).toBe(10);
    expect(to.getUTCMinutes()).toBe(30);
  });

  it("31 Shahrivar -> 30 Mehr (Mehr has 30 days)", () => {
    const from = new Date("2026-09-22T08:00:00Z"); // 31 Shahrivar 1405
    expect(jalali(from)).toBe("6/31/1405 AP");
    expect(jalali(addJalaliMonth(from))).toBe("7/30/1405 AP");
  });

  it("across the year: 15 Esfand -> 15 Farvardin", () => {
    const from = new Date("2027-03-06T08:00:00Z");
    expect(jalali(from)).toBe("12/15/1405 AP");
    expect(jalali(addJalaliMonth(from))).toBe("1/15/1406 AP");
  });

  it("every day of two years lands in the next month, on the same day or the month's last", () => {
    for (let i = 0; i < 730; i++) {
      const from = new Date(Date.UTC(2026, 2, 21, 8) + i * DAY);
      const [fm, fd] = jalali(from).split("/").map(Number);
      const to = addJalaliMonth(from);
      const [tm, td] = jalali(to).split("/").map(Number);
      expect(tm).toBe(fm === 12 ? 1 : fm + 1);
      if (td !== fd) {
        expect(td).toBeLessThan(fd);
        expect(jalali(new Date(to.getTime() + DAY)).split("/")[0]).not.toBe(String(tm)); // last day
      }
    }
  });

  it("30 Bahman -> last day of Esfand", () => {
    const from = new Date("2027-02-19T08:00:00Z");
    expect(jalali(from)).toBe("11/30/1405 AP");
    const to = jalali(addJalaliMonth(from));
    expect(["12/29/1405 AP", "12/30/1405 AP"]).toContain(to);
  });
});
