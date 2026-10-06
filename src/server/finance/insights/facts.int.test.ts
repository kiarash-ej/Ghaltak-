import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { OrderStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { hasTestDatabase } from "@/test/setup";
import type { FinanceRange } from "../periods";
import type { FinanceTotals } from "../summary";
import { loadInsightFacts } from "./facts";

// What the advice rules are given (spec §6.5), against a hand-counted store.
//
// now = 2026-10-06 08:30Z (12:00 Tehran, Monday 14 Mehr).
// Period:   [2026-09-29 20:30Z, now)          Previous: [2026-09-22 20:30Z, 2026-09-29 20:30Z)
//
//  order  status           placed (UTC)            customer  lines                         notes
//  o1     DELIVERED        2026-10-01 10:00 (Thu)  c1        A 2×1000 @600, B 1×500        period sale
//  o2     PAID             2026-10-02 10:00 (Fri)  c2        A 1×1000 @600                 period sale; c2's first
//  o3     RETURNED         2026-10-02 11:00        c2        B 2×500                       period return
//  o9     PAID             2026-10-03 10:00 (Sat)  c3        D 5×50 (D inactive)           period sale
//  o4     PAID             2026-09-24 10:00 (Thu)  c1        A 1×1000 @600                 previous sale
//  o5     DELIVERED        2026-09-26 21:00        c3        B 3×500                       previous; Sunday 00:30 in Tehran
//  o10    DELIVERED        2026-08-01 10:00        c1        A 1×1000 @600                 the store's first sale
//  o6     PENDING_PAYMENT  now − 3 days            c2        700 + 100 shipping, receipt   stale
//  o8     PENDING_PAYMENT  now − 5 days            c2        300                           stale
//  o7     PENDING_PAYMENT  now − 1 day             c2        900                           not yet stale
//
// Products: A 3000 (3 units, all costed, cogs 1800; previous 1000), B 500 (no
// cost; previous 1500; 2 returned units), D 250. Ads in the period: 400 (a
// previous-period ad, rent, a voided ad and another seller's ad don't count).
// Buyers in the period: c1 (returning, 2500), c2 (new), c3 (returning, 250).
// 30-day units: A 4 (variant Av 4, stock 2), B 4 (Bv 4, stock 10; Bv2 0, stock 0);
// D is inactive, so not a "best seller" to restock. Weekdays (Saturday first)
// over the 8 weeks before today: Sat 250, Sun 1500, Thu 2500 + 1000, Fri 1000.
// Links this month: «پاییزه» 70 views, 0 paid; an inactive link is left out.

const NOW = new Date("2026-10-06T08:30:00Z");
const DAY = 24 * 60 * 60 * 1000;
const RANGE: FinanceRange = {
  preset: "custom",
  from: new Date("2026-09-29T20:30:00Z"),
  to: NOW,
  previous: { from: new Date("2026-09-22T20:30:00Z"), to: new Date("2026-09-29T20:30:00Z") },
  label: "این بازه",
  compareLabel: "بازهٔ قبل",
};

describe.skipIf(!hasTestDatabase)("advice facts (database)", () => {
  const runId = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  let sellerId = "";
  let otherSellerId = "";
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    sellerId = (await prisma.seller.create({ data: { name: "advice", mobile: `0984${runId}` } })).id;
    otherSellerId = (await prisma.seller.create({ data: { name: "other", mobile: `0985${runId}` } })).id;
    const a = await prisma.product.create({ data: { sellerId, name: "A", price: 1000, costPrice: 600 } });
    const b = await prisma.product.create({ data: { sellerId, name: "B", price: 500 } });
    const d = await prisma.product.create({ data: { sellerId, name: "D", price: 50, isActive: false } });
    const x = await prisma.product.create({ data: { sellerId: otherSellerId, name: "X", price: 1 } });
    const av = await prisma.productVariant.create({ data: { sellerId, productId: a.id, color: "مشکی", stock: 2 } });
    const bv = await prisma.productVariant.create({ data: { sellerId, productId: b.id, size: "M", stock: 10 } });
    const bv2 = await prisma.productVariant.create({ data: { sellerId, productId: b.id, size: "L", stock: 0 } });
    const dv = await prisma.productVariant.create({ data: { sellerId, productId: d.id, stock: 1 } });
    const xv = await prisma.productVariant.create({ data: { sellerId: otherSellerId, productId: x.id, stock: 0 } });
    Object.assign(ids, { a: a.id, b: b.id, d: d.id, av: av.id, bv: bv.id, bv2: bv2.id });

    const customer = (owner: string, n: number) => prisma.customer.create({ data: { sellerId: owner, phone: `09${n}${runId}` } });
    const [c1, c2, c3, oc] = await Promise.all([customer(sellerId, 16), customer(sellerId, 17), customer(sellerId, 18), customer(otherSellerId, 19)]);

    type Line = { productId: string; productVariantId: string; quantity: number; unitPrice: number; unitCost?: number };
    const order = (owner: string, customerId: string, status: OrderStatus, createdAt: Date | string, lines: Line[], extra = {}) =>
      prisma.order.create({
        data: {
          sellerId: owner,
          customerId,
          status,
          createdAt: new Date(createdAt),
          totalPrice: lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0),
          items: { create: lines.map((l) => ({ ...l, unitCost: l.unitCost ?? null })) },
          ...extra,
        },
      });
    const A = (quantity: number) => ({ productId: a.id, productVariantId: av.id, quantity, unitPrice: 1000, unitCost: 600 });
    const B = (quantity: number) => ({ productId: b.id, productVariantId: bv.id, quantity, unitPrice: 500 });
    await order(sellerId, c1.id, "DELIVERED", "2026-10-01T10:00:00Z", [A(2), B(1)]);
    await order(sellerId, c2.id, "PAID", "2026-10-02T10:00:00Z", [A(1)]);
    await order(sellerId, c2.id, "RETURNED", "2026-10-02T11:00:00Z", [B(2)]);
    await order(sellerId, c3.id, "PAID", "2026-10-03T10:00:00Z", [{ productId: d.id, productVariantId: dv.id, quantity: 5, unitPrice: 50 }]);
    await order(sellerId, c1.id, "PAID", "2026-09-24T10:00:00Z", [A(1)]);
    await order(sellerId, c3.id, "DELIVERED", "2026-09-26T21:00:00Z", [B(3)]);
    await order(sellerId, c1.id, "DELIVERED", "2026-08-01T10:00:00Z", [A(1)]);
    const pending = (days: number, unitPrice: number, extra = {}) =>
      order(sellerId, c2.id, "PENDING_PAYMENT", new Date(NOW.getTime() - days * DAY), [{ ...B(1), unitPrice }], extra);
    await pending(3, 700, { shippingCost: 100, receiptImageUrl: "receipts/x.jpg" });
    await pending(5, 300);
    await pending(1, 900);
    // Another seller, everywhere at once: never counted.
    const X = { productId: x.id, productVariantId: xv.id, quantity: 9, unitPrice: 99_000 };
    await order(otherSellerId, oc.id, "PAID", "2026-10-02T10:00:00Z", [X]);
    await order(otherSellerId, oc.id, "PENDING_PAYMENT", new Date(NOW.getTime() - 4 * DAY), [X]);

    const expense = (owner: string, day: string, amount: number, category: "ADS" | "RENT" = "ADS", voided = false) =>
      prisma.expense.create({ data: { sellerId: owner, category, amount, spentOn: new Date(`${day}T00:00:00Z`), voidedAt: voided ? new Date() : null } });
    await expense(sellerId, "2026-10-02", 400);
    await expense(sellerId, "2026-09-25", 999);
    await expense(sellerId, "2026-10-02", 100, "RENT");
    await expense(sellerId, "2026-10-03", 77, "ADS", true);
    await expense(otherSellerId, "2026-10-02", 5000);

    const link = (owner: string, title: string, isActive: boolean, views: number) =>
      prisma.purchaseLink.create({
        data: {
          sellerId: owner,
          token: `adv${title}${runId}`,
          title,
          isActive,
          dailyViews: { create: { day: new Date("2026-10-01T00:00:00Z"), views } },
        },
      });
    ids.link = (await link(sellerId, "پاییزه", true, 70)).id;
    await link(sellerId, "قدیمی", false, 100);
    await link(otherSellerId, "دیگری", true, 500);
  });

  afterAll(async () => {
    const sellers = { sellerId: { in: [sellerId, otherSellerId] } };
    await prisma.expense.deleteMany({ where: sellers });
    await prisma.order.deleteMany({ where: sellers });
    await prisma.purchaseLink.deleteMany({ where: sellers });
    await prisma.productVariant.deleteMany({ where: sellers });
    await prisma.product.deleteMany({ where: sellers });
    await prisma.customer.deleteMany({ where: sellers });
    await prisma.seller.deleteMany({ where: { id: { in: [sellerId, otherSellerId] } } });
  });

  it("gathers each rule's numbers by hand-counted definitions", async () => {
    const current = { sales: 1 } as FinanceTotals;
    const previous = { sales: 2 } as FinanceTotals;
    const facts = await loadInsightFacts(sellerId, RANGE, { current, previous }, NOW);

    expect(facts.current).toBe(current);
    expect(facts.previous).toBe(previous);
    expect(facts.products).toEqual([
      { productId: ids.a, name: "A", sales: 3000, units: 3, costedSales: 3000, cogs: 1800, previousSales: 1000, returnedUnits: 0 },
      { productId: ids.b, name: "B", sales: 500, units: 1, costedSales: 0, cogs: 0, previousSales: 1500, returnedUnits: 2 },
      { productId: ids.d, name: "D", sales: 250, units: 5, costedSales: 0, cogs: 0, previousSales: 0, returnedUnits: 0 },
    ]);
    expect(facts.adsExpenses).toBe(400);
    expect(facts.staleUnpaid).toEqual({ orders: 2, amount: 800 + 300, withReceipt: 1 });
    expect([...facts.stock].sort((p, q) => p.variantId.localeCompare(q.variantId))).toEqual(
      [
        { variantId: ids.av, productId: ids.a, name: "A", color: "مشکی", size: null, stock: 2, units30: 4, productUnits30: 4 },
        { variantId: ids.bv, productId: ids.b, name: "B", color: null, size: "M", stock: 10, units30: 4, productUnits30: 4 },
        { variantId: ids.bv2, productId: ids.b, name: "B", color: null, size: "L", stock: 0, units30: 0, productUnits30: 4 },
      ].sort((p, q) => p.variantId.localeCompare(q.variantId)),
    );
    expect(facts.links).toEqual([{ linkId: ids.link, title: "پاییزه", views: 70, paid: 0 }]);
    expect(facts.customers).toEqual({ buyers: 3, returningBuyers: 2, returningSales: 2500 + 250 });
    expect(facts.weekdays).toEqual({ sales: [250, 1500, 0, 0, 0, 2500 + 1000, 1000], orders: 5, daysSinceFirstSale: 65 });
  });

  it("for a period report, only the period's facts: nothing about today", async () => {
    const totals = { current: { sales: 1 } as FinanceTotals, previous: { sales: 2 } as FinanceTotals };
    const [all, period] = await Promise.all([
      loadInsightFacts(sellerId, RANGE, totals, NOW),
      loadInsightFacts(sellerId, RANGE, totals, NOW, "period"),
    ]);
    expect({ products: period.products, ads: period.adsExpenses, customers: period.customers }).toEqual({
      products: all.products,
      ads: all.adsExpenses,
      customers: all.customers,
    });
    expect(period.staleUnpaid).toEqual({ orders: 0, amount: 0, withReceipt: 0 });
    expect(period.stock).toEqual([]);
    expect(period.links).toEqual([]);
    expect(period.weekdays).toEqual({ sales: [0, 0, 0, 0, 0, 0, 0], orders: 0, daysSinceFirstSale: null });
  });
});
