import { describe, expect, it } from "vitest";
import { compare, explain } from "./glossary";
import type { FinanceTotals } from "./summary";

const totals: FinanceTotals = {
  sales: 48_600_000,
  saleOrders: 64,
  cogs: 24_100_000,
  coverage: 1,
  grossProfit: 24_500_000,
  expenses: 6_300_000,
  netProfit: 18_200_000,
  margin: 18_200_000 / 48_600_000,
  averageOrder: 759_375,
  ordersPlaced: 70,
  returnRate: 0.04,
  cancelRate: 0.05,
};

describe("compare", () => {
  it("amounts and counts: percent change, up is good", () => {
    expect(compare(48_600_000, 41_186_441, "amount", "همین بازه در شهریور")).toEqual({
      text: "▲ ۱۸٪ نسبت به همین بازه در شهریور",
      tone: "up",
    });
    expect(compare(90, 100, "amount", "ماه قبل")).toEqual({ text: "▼ ۱۰٪ نسبت به ماه قبل", tone: "down" });
  });

  it("rates: change in percentage points; for returns, down is good", () => {
    expect(compare(0.374, 0.314, "rate", "ماه قبل")).toEqual({ text: "▲ ۶ واحد نسبت به ماه قبل", tone: "up" });
    expect(compare(0.08, 0.04, "badRate", "ماه قبل")).toEqual({ text: "▲ ۴ واحد نسبت به ماه قبل", tone: "down" });
    expect(compare(0.02, 0.04, "badRate", "ماه قبل")).toEqual({ text: "▼ ۲ واحد نسبت به ماه قبل", tone: "up" });
  });

  it("says nothing without a base, and «like before» when nothing changed", () => {
    expect(compare(100, 0, "amount", "ماه قبل")).toBeUndefined();
    expect(compare(null, 0.3, "rate", "ماه قبل")).toBeUndefined();
    expect(compare(100, 100, "amount", "ماه قبل")).toEqual({ text: "مثل ماه قبل", tone: "flat" });
  });
});

describe("explain", () => {
  it("puts the store's own figure in the explanation", () => {
    expect(explain("netProfit", totals).body).toContain("از هر ۱۰۰ هزار تومان فروش، حدود ۳۷ هزار تومان");
    expect(explain("averageOrder", totals).body).toContain("۷۵۹٬۳۷۵ تومان");
  });

  it("says when profit rests on part of the sales only", () => {
    const partial = explain("netProfit", { ...totals, coverage: 0.78 }).body;
    expect(partial).toContain("۷۸٪");
  });

  it("has a title and text for every number on the page", () => {
    for (const metric of ["sales", "netProfit", "margin", "saleOrders", "averageOrder", "returnRate", "cogs", "expenses", "grossProfit"] as const) {
      const e = explain(metric, totals);
      expect(e.title.length, metric).toBeGreaterThan(3);
      expect(e.body.length, metric).toBeGreaterThan(20);
    }
  });
});
