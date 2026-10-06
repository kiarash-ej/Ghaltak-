import { describe, expect, it } from "vitest";
import type { FinanceTotals } from "../summary";
import { advise, rankInsights, type Insight } from "./index";
import {
  bestWeekday,
  costsOutpacing,
  growthDriver,
  linkNotConverting,
  missingCosts,
  repeatCustomers,
  returnsJump,
  runningOut,
  salesTrend,
  smallerOrders,
  staleUnpaid,
  thinMargin,
} from "./rules";
import type { InsightFacts, ProductFacts, StockFacts } from "./types";

// Each advice rule (spec §6.5): it fires on the data it is about, stays quiet
// just below its threshold or minimum data, and the ranking puts missing
// costs first, then the largest tomans, then warnings, tips, good news.

const totals = (t: Partial<FinanceTotals> = {}): FinanceTotals => ({
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

const facts = (f: Partial<InsightFacts> = {}): InsightFacts => ({
  label: "این ماه (مهر)",
  compareLabel: "همین بازه در شهریور",
  current: totals(),
  previous: totals(),
  products: [],
  adsExpenses: 0,
  staleUnpaid: { orders: 0, amount: 0, withReceipt: 0 },
  stock: [],
  links: [],
  customers: { buyers: 0, returningBuyers: 0, returningSales: 0 },
  weekdays: { sales: [0, 0, 0, 0, 0, 0, 0], orders: 0, daysSinceFirstSale: null },
  ...f,
});

const product = (p: Partial<ProductFacts> & { name: string }): ProductFacts => ({
  productId: `id-${p.name}`,
  sales: 0,
  units: 0,
  costedSales: 0,
  cogs: 0,
  previousSales: 0,
  returnedUnits: 0,
  ...p,
});

const variant = (s: Partial<StockFacts> & { name: string }): StockFacts => ({
  variantId: `v-${s.name}`,
  productId: `id-${s.name}`,
  color: null,
  size: null,
  stock: 0,
  units30: 0,
  productUnits30: 0,
  ...s,
});

it("an empty store gets no advice at all", () => {
  expect(advise(facts())).toEqual([]);
});

describe("1. sales trend", () => {
  const before = totals({ sales: 10_000_000, saleOrders: 5 });
  it("fires at ±10% on at least 5 previous sales", () => {
    const up = salesTrend(facts({ current: totals({ sales: 12_300_000 }), previous: before }));
    expect(up).toMatchObject({ id: "sales-trend", tone: "good", title: "فروش ۲۳٪ بیشتر شد" });
    expect(up!.body).toContain("این ماه (مهر) حدود ۱۲٫۳ میلیون تومان فروختید و همین بازه در شهریور حدود ۱۰ میلیون تومان");
    expect(salesTrend(facts({ current: totals({ sales: 9_000_000 }), previous: before }))).toMatchObject({ tone: "warn", title: "فروش ۱۰٪ کمتر شد" });
  });
  it("stays quiet under 10% or on fewer than 5 previous sales", () => {
    expect(salesTrend(facts({ current: totals({ sales: 10_900_000 }), previous: before }))).toBeNull();
    expect(salesTrend(facts({ current: totals({ sales: 30_000_000 }), previous: totals({ sales: 10_000_000, saleOrders: 4 }) }))).toBeNull();
  });
});

describe("2. growth driver", () => {
  const grew = { current: totals({ sales: 15_000_000 }), previous: totals({ sales: 10_000_000, saleOrders: 8 }) };
  it("names the product with the largest increase when sales grew", () => {
    const insight = growthDriver(
      facts({
        ...grew,
        products: [
          product({ name: "کیف", sales: 6_000_000, previousSales: 5_000_000 }),
          product({ name: "شال", sales: 5_000_000, previousSales: 1_000_000 }),
        ],
      }),
    );
    expect(insight).toMatchObject({ id: "growth-driver", tone: "good", title: "«شال» رشد فروش را جلو برد" });
    expect(insight!.body).toContain("حدود ۸۰٪ از کل رشد فروش شما");
    expect(insight!.action!.href).toBe(`/inventory?q=${encodeURIComponent("شال")}`);
  });
  it("needs sales to have grown (rule 1, up) and a product that grew", () => {
    const shal = [product({ name: "شال", sales: 5_000_000, previousSales: 1_000_000 })];
    expect(growthDriver(facts({ current: totals({ sales: 8_000_000 }), previous: grew.previous, products: shal }))).toBeNull();
    expect(growthDriver(facts({ ...grew, products: [product({ name: "شال", sales: 1, previousSales: 2 })] }))).toBeNull();
  });
});

describe("3. thin-margin best seller", () => {
  it("a top-5 product under 15% gross margin; impact is 10% of its sales", () => {
    const insight = thinMargin(
      facts({ products: [product({ name: "شال", sales: 2_500_000, units: 10, costedSales: 2_500_000, cogs: 2_300_000 })] }),
    );
    expect(insight).toMatchObject({ id: "thin-margin", tone: "warn", impactToman: 250_000, title: "«شال» پرفروش است ولی کم‌سود" });
    expect(insight!.body).toContain("فقط ۸٪ سود ناخالص");
    expect(insight!.body).toContain("حدود ۲۵۰ هزار تومان");
    expect(insight!.action!.href).toBe("/products/id-شال/edit");
  });
  it("says so when it sells below cost", () => {
    const insight = thinMargin(facts({ products: [product({ name: "شال", sales: 1_000_000, costedSales: 1_000_000, cogs: 1_100_000 })] }));
    expect(insight!.title).toBe("«شال» زیر قیمت خرید فروخته می‌شود");
  });
  it("not at 15%, not without a known cost, not outside the top 5", () => {
    expect(thinMargin(facts({ products: [product({ name: "a", sales: 1_000, costedSales: 1_000, cogs: 850 })] }))).toBeNull();
    expect(thinMargin(facts({ products: [product({ name: "a", sales: 1_000, costedSales: 400, cogs: 390 })] }))).toBeNull();
    const top = ["a", "b", "c", "d", "e"].map((name) => product({ name, sales: 10_000, costedSales: 10_000, cogs: 5_000 }));
    expect(thinMargin(facts({ products: [...top, product({ name: "f", sales: 9_000, costedSales: 9_000, cogs: 9_000 })] }))).toBeNull();
  });
});

describe("4. missing costs", () => {
  it("fires under 90% coverage and counts the products without a cost", () => {
    const insight = missingCosts(
      facts({
        current: totals({ sales: 1_000, coverage: 0.78 }),
        products: [product({ name: "a", sales: 600, costedSales: 600 }), product({ name: "b", sales: 400, costedSales: 180 }), product({ name: "c", previousSales: 5 })],
      }),
    );
    expect(insight).toMatchObject({ id: "missing-costs", tone: "warn", action: { href: "/finance/products?missing=1" } });
    expect(insight!.body).toContain("فقط ۷۸٪ فروش‌های این بازه قیمت خرید دارند؛ ۱ محصول فروش‌رفته قیمت خرید ندارد");
  });
  it("not at 90%, not without sales", () => {
    expect(missingCosts(facts({ current: totals({ sales: 1_000, coverage: 0.9 }) }))).toBeNull();
    expect(missingCosts(facts())).toBeNull();
  });
});

describe("5. unpaid for over 48 hours", () => {
  it("counts the orders and what they owe, and points out receipts to review", () => {
    const insight = staleUnpaid(facts({ staleUnpaid: { orders: 5, amount: 3_200_000, withReceipt: 2 } }));
    expect(insight).toMatchObject({ id: "stale-unpaid", impactToman: 3_200_000, title: "۵ سفارش بیش از ۲ روز منتظر پرداخت است" });
    expect(insight!.body).toContain("روی هم حدود ۳٫۲ میلیون تومان");
    expect(insight!.body).toContain("۲ تا رسید فرستاده‌اند");
    expect(insight!.body).toContain("یادآوری");
  });
  it("no reminder advice when every one of them sent a receipt", () => {
    const insight = staleUnpaid(facts({ staleUnpaid: { orders: 2, amount: 100_000, withReceipt: 2 } }));
    expect(insight!.body).toContain("همه رسید فرستاده‌اند");
    expect(insight!.body).not.toContain("یادآوری");
  });
  it("quiet when nothing is waiting", () => {
    expect(staleUnpaid(facts())).toBeNull();
  });
});

describe("6. returns jump", () => {
  it("at 10% or more, with at least 3 returns; names the most returned product", () => {
    const insight = returnsJump(
      facts({
        current: totals({ returnedOrders: 3, returnRate: 0.12 }),
        previous: totals({ returnRate: 0.1 }),
        products: [product({ name: "مانتو", returnedUnits: 2 }), product({ name: "شال", returnedUnits: 1 })],
      }),
    );
    expect(insight).toMatchObject({ id: "returns-jump", title: "نرخ مرجوعی به ۱۲٪ رسید" });
    expect(insight!.body).toContain("(همین بازه در شهریور: ۱۰٪)");
    expect(insight!.body).toContain("«مانتو»");
  });
  it("when it doubled, even under 10%", () => {
    expect(returnsJump(facts({ current: totals({ returnedOrders: 4, returnRate: 0.06 }), previous: totals({ returnRate: 0.03 }) }))).not.toBeNull();
    expect(returnsJump(facts({ current: totals({ returnedOrders: 4, returnRate: 0.05 }), previous: totals({ returnRate: 0.03 }) }))).toBeNull();
  });
  it("never on fewer than 3 returns", () => {
    expect(returnsJump(facts({ current: totals({ returnedOrders: 2, returnRate: 0.5 }), previous: totals({ returnRate: 0 }) }))).toBeNull();
  });
});

describe("7. smaller orders", () => {
  it("average order down 10%+ on 10+ sales in both periods", () => {
    const insight = smallerOrders(facts({ current: totals({ saleOrders: 10, averageOrder: 720_000 }), previous: totals({ saleOrders: 12, averageOrder: 800_000 }) }));
    expect(insight).toMatchObject({ id: "smaller-orders", tone: "tip", title: "میانگین هر سفارش ۱۰٪ کمتر شد" });
  });
  it("not on fewer than 10 sales, not under 10%", () => {
    expect(smallerOrders(facts({ current: totals({ saleOrders: 9, averageOrder: 400_000 }), previous: totals({ saleOrders: 12, averageOrder: 800_000 }) }))).toBeNull();
    expect(smallerOrders(facts({ current: totals({ saleOrders: 10, averageOrder: 730_000 }), previous: totals({ saleOrders: 12, averageOrder: 800_000 }) }))).toBeNull();
  });
});

describe("8. costs outpacing sales", () => {
  it("ads at 25% of sales or more", () => {
    const insight = costsOutpacing(facts({ current: totals({ sales: 4_000_000 }), adsExpenses: 1_000_000 }));
    expect(insight).toMatchObject({ id: "costs-outpacing", title: "تبلیغ ۲۵٪ فروش را می‌برد", action: { href: "/finance/expenses" } });
  });
  it("expenses growing 20+ points faster than sales", () => {
    const insight = costsOutpacing(
      facts({ current: totals({ sales: 11_000_000, expenses: 1_300_000 }), previous: totals({ sales: 10_000_000, expenses: 1_000_000 }) }),
    );
    expect(insight).toMatchObject({ title: "هزینه‌ها تندتر از فروش بالا رفت" });
    expect(insight!.body).toContain("هزینه‌ها ۳۰٪ بیشتر و فروش ۱۰٪ بیشتر شد");
  });
  it("quiet under both thresholds and without previous expenses", () => {
    expect(costsOutpacing(facts({ current: totals({ sales: 4_000_000 }), adsExpenses: 990_000 }))).toBeNull();
    expect(costsOutpacing(facts({ current: totals({ sales: 11_000_000, expenses: 1_290_000 }), previous: totals({ sales: 10_000_000, expenses: 1_000_000 }) }))).toBeNull();
    expect(costsOutpacing(facts({ current: totals({ sales: 1_000, expenses: 900 }), previous: totals({ sales: 1_000 }) }))).toBeNull();
  });
});

describe("9. about to run out", () => {
  it("a best seller's variant with under 7 days of stock at its pace", () => {
    const insight = runningOut(facts({ stock: [variant({ name: "شال", color: "مشکی", size: "M", stock: 3, units30: 30, productUnits30: 40 })] }));
    expect(insight).toMatchObject({ id: "running-out", title: "«شال» (مشکی، M) به‌زودی تمام می‌شود" });
    expect(insight!.body).toContain("حدود ۳ روز دیگر");
  });
  it("lists several, soonest first, and says when one is already out", () => {
    const insight = runningOut(
      facts({
        stock: [
          variant({ name: "a", stock: 5, units30: 30, productUnits30: 30 }),
          variant({ name: "b", stock: 0, units30: 2, productUnits30: 6 }),
          variant({ name: "c", stock: 100, units30: 30, productUnits30: 30 }),
        ],
      }),
    );
    expect(insight!.title).toBe("۲ کالای پرفروش به‌زودی تمام می‌شود");
    expect(insight!.body.indexOf("«b» تمام شده است")).toBeLessThan(insight!.body.indexOf("«a»"));
  });
  it("not with 7 days left, nor on too few sales to tell", () => {
    expect(runningOut(facts({ stock: [variant({ name: "a", stock: 7, units30: 30, productUnits30: 30 })] }))).toBeNull();
    expect(runningOut(facts({ stock: [variant({ name: "a", stock: 0, units30: 1, productUnits30: 30 })] }))).toBeNull();
    expect(runningOut(facts({ stock: [variant({ name: "a", stock: 0, units30: 4, productUnits30: 4 })] }))).toBeNull();
  });
});

describe("10. link not converting", () => {
  it("the busiest link with 50+ views and under 2% paid", () => {
    const insight = linkNotConverting(
      facts({
        links: [
          { linkId: "1", title: "پاییزه", views: 60, paid: 1 },
          { linkId: "2", title: "تخفیف", views: 120, paid: 0 },
          { linkId: "3", title: "خوب", views: 500, paid: 40 },
        ],
      }),
    );
    expect(insight).toMatchObject({ id: "link-not-converting", title: "لینک «تخفیف» دیده می‌شود ولی کم فروش می‌آورد" });
    expect(insight!.body).toContain("۱۲۰ بار باز شده و هنوز هیچ سفارش پرداخت‌شده‌ای نیاورده");
  });
  it("not under 50 views, not at 2%", () => {
    expect(linkNotConverting(facts({ links: [{ linkId: "1", title: null, views: 49, paid: 0 }] }))).toBeNull();
    expect(linkNotConverting(facts({ links: [{ linkId: "1", title: null, views: 50, paid: 1 }] }))).toBeNull();
  });
});

describe("11. repeat customers", () => {
  it("good news at 30%+ of sales from returning customers (5+ buyers)", () => {
    const insight = repeatCustomers(facts({ current: totals({ sales: 1_000 }), customers: { buyers: 5, returningBuyers: 2, returningSales: 300 } }));
    expect(insight).toMatchObject({ tone: "good", title: "۳۰٪ فروش از مشتری‌های قدیمی بود" });
  });
  it("a tip under 10% with 20+ buyers", () => {
    const insight = repeatCustomers(facts({ current: totals({ sales: 1_000 }), customers: { buyers: 20, returningBuyers: 1, returningSales: 99 } }));
    expect(insight).toMatchObject({ tone: "tip", title: "مشتری‌ها کمتر برای خرید دوم برمی‌گردند" });
  });
  it("quiet in between, and on too few buyers", () => {
    expect(repeatCustomers(facts({ current: totals({ sales: 1_000 }), customers: { buyers: 50, returningBuyers: 5, returningSales: 200 } }))).toBeNull();
    expect(repeatCustomers(facts({ current: totals({ sales: 1_000 }), customers: { buyers: 4, returningBuyers: 4, returningSales: 1_000 } }))).toBeNull();
    expect(repeatCustomers(facts({ current: totals({ sales: 1_000 }), customers: { buyers: 19, returningBuyers: 0, returningSales: 0 } }))).toBeNull();
  });
});

describe("12. best weekday", () => {
  // Saturday first: Thursday sells 2× an average day.
  const sales = [100, 100, 100, 100, 100, 250, 50];
  it("with 4+ weeks of sales, a weekday at 1.4× the average", () => {
    const insight = bestWeekday(facts({ weekdays: { sales, orders: 20, daysSinceFirstSale: 28 } }));
    expect(insight).toMatchObject({ id: "best-weekday", title: "پنجشنبه‌ها پرفروش‌ترین روز شماست" });
    expect(insight!.body).toContain("حدود ۲٫۲ برابر");
  });
  it("not before 4 weeks, not on fewer than 20 sales, not under 1.4×", () => {
    expect(bestWeekday(facts({ weekdays: { sales, orders: 20, daysSinceFirstSale: 27 } }))).toBeNull();
    expect(bestWeekday(facts({ weekdays: { sales, orders: 19, daysSinceFirstSale: 60 } }))).toBeNull();
    expect(bestWeekday(facts({ weekdays: { sales: [100, 100, 100, 100, 100, 135, 65], orders: 50, daysSinceFirstSale: 60 } }))).toBeNull();
  });
});

describe("ranking", () => {
  const insight = (id: string, rule: number, tone: Insight["tone"], impactToman?: number): Insight => ({ id, rule, tone, title: id, body: "", impactToman });

  it("missing costs first, then tomans, then warn > tip > good, then the rule number", () => {
    const ranked = rankInsights([
      insight("best-weekday", 12, "tip"),
      insight("sales-trend", 1, "good"),
      insight("thin-margin", 3, "warn", 250_000),
      insight("returns-jump", 6, "warn"),
      insight("smaller-orders", 7, "tip"),
      insight("missing-costs", 4, "warn"),
      insight("stale-unpaid", 5, "warn", 3_200_000),
      insight("running-out", 9, "warn"),
    ]);
    expect(ranked.map((i) => i.id)).toEqual([
      "missing-costs",
      "stale-unpaid",
      "thin-margin",
      "returns-jump",
      "running-out",
      "smaller-orders",
      "best-weekday",
      "sales-trend",
    ]);
  });

  it("advise runs every rule and ranks what fired", () => {
    const ranked = advise(
      facts({
        current: totals({ sales: 1_000_000, coverage: 0.5 }),
        staleUnpaid: { orders: 1, amount: 50_000, withReceipt: 0 },
        links: [{ linkId: "1", title: null, views: 80, paid: 0 }],
      }),
    );
    expect(ranked.map((i) => i.id)).toEqual(["missing-costs", "stale-unpaid", "link-not-converting"]);
  });
});
