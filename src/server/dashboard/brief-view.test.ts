import { describe, expect, it } from "vitest";
import type { DailyBrief } from "./brief";
import { buildBriefView } from "./brief-view";

// The brief is a client component: whatever buildBriefView returns is
// serialized into the page. An operator's copy must carry no money at all.

const brief: DailyBrief = {
  dayKey: "2026-10-06",
  yesterdayWeekday: "دوشنبه",
  sales: 6_437_500,
  orders: 9,
  lastWeekSales: 5_300_000,
  week: [
    { key: "2026-09-29", total: 1_111_111 },
    { key: "2026-09-30", total: 0 },
    { key: "2026-10-01", total: 2_222_222 },
    { key: "2026-10-02", total: 0 },
    { key: "2026-10-03", total: 3_333_333 },
    { key: "2026-10-04", total: 0 },
    { key: "2026-10-05", total: 6_437_500 },
  ],
  hasSales: true,
};
const attention = { receipts: 3, readyToShip: 5, lowStock: 2 };

describe("buildBriefView", () => {
  it("gives the owner yesterday's sales, the comparison and the week", () => {
    const view = buildBriefView(brief, attention, "OWNER");
    expect(view.money).toEqual({
      sales: { value: 6.4, decimals: 1, unit: "میلیون تومان" },
      delta: { text: "▲ ۲۱٪ نسبت به دوشنبهٔ قبل", tone: "up" },
      week: [1_111_111, 0, 2_222_222, 0, 3_333_333, 0, 6_437_500],
      weekTotal: { value: 13.1, decimals: 1, unit: "میلیون تومان" },
    });
    expect(view.orders).toBe(9);
    expect(view.todos.map((t) => t.text)).toEqual(["۳ رسید منتظر تأیید", "۵ سفارش آمادهٔ ارسال"]);
  });

  it("an operator's copy has counts and to-dos but no money, in any form", () => {
    const view = buildBriefView(brief, attention, "OPERATOR");
    expect(view.money).toBeNull();
    expect(view.orders).toBe(9);
    expect(view.todos).toHaveLength(2);

    // What would be serialized into the operator's page.
    const sent = JSON.stringify(view);
    for (const amount of ["6437500", "5300000", "1111111", "2222222", "3333333", "13.1", "6.4", "میلیون", "تومان"]) {
      expect(sent, amount).not.toContain(amount);
    }
  });
});
