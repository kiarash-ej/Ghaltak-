import { describe, expect, it } from "vitest";
import { periodStory } from "./story";
import type { FinanceTotals } from "./summary";

const totals = (t: Partial<FinanceTotals>): FinanceTotals => ({
  sales: 0,
  saleOrders: 0,
  cogs: 0,
  coverage: null,
  grossProfit: 0,
  expenses: 0,
  netProfit: 0,
  margin: null,
  averageOrder: null,
  ordersPlaced: 0,
  returnedOrders: 0,
  returnRate: null,
  cancelRate: null,
  ...t,
});

const text = (s: ReturnType<typeof periodStory>) => s.lead.map((p) => (typeof p === "string" ? p : p.strong)).join("");

describe("periodStory", () => {
  it("sales and net profit in one sentence, what it means, and the comparison", () => {
    const story = periodStory(
      "مهر ۱۴۰۵",
      "شهریور ۱۴۰۵",
      totals({ sales: 48_600_000, saleOrders: 64, netProfit: 18_200_000, margin: 18_200_000 / 48_600_000, coverage: 1 }),
      totals({ sales: 41_186_441 }),
    );
    expect(text(story)).toBe("در مهر ۱۴۰۵، ۴۸٫۶ میلیون تومان فروختید و ۱۸٫۲ میلیون تومان سود خالص بردید.");
    expect(story.lead[1]).toEqual({ strong: "۴۸٫۶ میلیون تومان" });
    expect(story.detail).toBe(
      "یعنی از هر ۱۰۰ هزار تومانی که مشتری پرداخت کرد، حدود ۳۷ هزار تومان بعد از کم کردن قیمت خرید کالا و هزینه‌ها برای شما ماند. فروش ۱۸٪ بیشتر از شهریور ۱۴۰۵ بود.",
    );
  });

  it("a loss is said plainly, and missing costs are pointed out", () => {
    const story = periodStory("آبان ۱۴۰۵", "مهر ۱۴۰۵", totals({ sales: 2_000_000, saleOrders: 3, netProfit: -500_000, margin: -0.25, coverage: 0.5 }), totals({}));
    expect(text(story)).toBe("در آبان ۱۴۰۵، ۲ میلیون تومان فروختید و ۵۰۰ هزار تومان زیان دادید.");
    expect(story.detail).toBe("فقط ۵۰٪ فروش‌ها قیمت خرید دارند، پس سود واقعی کمتر است.");
  });

  it("a period without sales", () => {
    expect(periodStory("دی ۱۴۰۵", "آذر ۱۴۰۵", totals({ expenses: 300_000 }), totals({}))).toEqual({
      lead: ["در دی ۱۴۰۵ فروشی ثبت نشد."],
      detail: "هزینه‌های این دوره ۳۰۰ هزار تومان بود.",
    });
  });
});
