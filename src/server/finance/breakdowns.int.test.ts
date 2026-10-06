import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { OrderSource, OrderStatus, PaymentMethod } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { hasTestDatabase } from "@/test/setup";
import { getDailySales, getProductProfit, getSalesBreakdown } from "./breakdowns";

// The «فروش» and «سود محصولات» numbers (spec §6.4), counted by hand.
// Range: 1–2 Mehr 1405 (2026-09-22 20:30Z → 2026-09-24 20:30Z).
//
//  order  status     placed (UTC)            customer  source  payment       lines
//  o1     DELIVERED  2026-09-23 10:00 (Wed)  c1        manual  card-to-card  A 2×1000 @600, B 1×500
//  o2     PAID       2026-09-22 21:00        c2        link    online        A 1×1000, no cost (00:30 Wednesday in Tehran)
//  o3     CANCELED   2026-09-23 11:00        c1        manual  —             A 5×1000            ✗ not a sale
//  o4     PAID       2026-09-25 10:00        c1        manual  cash          A 1×1000            ✗ after the range
// Another seller's sale in the range never counts.

const FROM = new Date("2026-09-22T20:30:00Z");
const TO = new Date("2026-09-24T20:30:00Z");

describe.skipIf(!hasTestDatabase)("sales and product profit (database)", () => {
  const runId = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  let sellerId = "";
  let otherSellerId = "";
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    sellerId = (await prisma.seller.create({ data: { name: "breakdowns", mobile: `0988${runId}` } })).id;
    otherSellerId = (await prisma.seller.create({ data: { name: "other", mobile: `0989${runId}` } })).id;
    const a = await prisma.product.create({ data: { sellerId, name: "A", price: 1000, costPrice: 600 } });
    const b = await prisma.product.create({ data: { sellerId, name: "B", price: 500 } });
    const x = await prisma.product.create({ data: { sellerId: otherSellerId, name: "X", price: 1 } });
    const c1 = await prisma.customer.create({ data: { sellerId, name: "مریم", phone: `0916${runId}` } });
    const c2 = await prisma.customer.create({ data: { sellerId, phone: `0917${runId}` } });
    const oc = await prisma.customer.create({ data: { sellerId: otherSellerId, phone: `0918${runId}` } });
    Object.assign(ids, { a: a.id, b: b.id, c1: c1.id, c2: c2.id });

    type Line = { productId: string; quantity: number; unitPrice: number; unitCost?: number };
    const order = (owner: string, customerId: string, status: OrderStatus, createdAt: string, source: OrderSource, paymentMethod: PaymentMethod | null, lines: Line[]) =>
      prisma.order.create({
        data: {
          sellerId: owner,
          customerId,
          status,
          source,
          paymentMethod,
          createdAt: new Date(createdAt),
          totalPrice: lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0),
          items: { create: lines.map((l) => ({ ...l, unitCost: l.unitCost ?? null })) },
        },
      });
    await order(sellerId, c1.id, "DELIVERED", "2026-09-23T10:00:00Z", "MANUAL", "CARD_TO_CARD", [
      { productId: a.id, quantity: 2, unitPrice: 1000, unitCost: 600 },
      { productId: b.id, quantity: 1, unitPrice: 500 },
    ]);
    await order(sellerId, c2.id, "PAID", "2026-09-22T21:00:00Z", "PURCHASE_LINK", "ONLINE", [{ productId: a.id, quantity: 1, unitPrice: 1000 }]);
    await order(sellerId, c1.id, "CANCELED", "2026-09-23T11:00:00Z", "MANUAL", null, [{ productId: a.id, quantity: 5, unitPrice: 1000 }]);
    await order(sellerId, c1.id, "PAID", "2026-09-25T10:00:00Z", "MANUAL", "CASH", [{ productId: a.id, quantity: 1, unitPrice: 1000 }]);
    await order(otherSellerId, oc.id, "PAID", "2026-09-23T10:00:00Z", "MANUAL", "CASH", [{ productId: x.id, quantity: 9, unitPrice: 99_000 }]);
  });

  afterAll(async () => {
    const sellers = { sellerId: { in: [sellerId, otherSellerId] } };
    await prisma.order.deleteMany({ where: sellers });
    await prisma.product.deleteMany({ where: sellers });
    await prisma.customer.deleteMany({ where: sellers });
    await prisma.seller.deleteMany({ where: { id: { in: [sellerId, otherSellerId] } } });
  });

  it("sales per Tehran day", async () => {
    expect(await getDailySales(sellerId, FROM, TO)).toEqual([{ key: "2026-09-23", sales: 3500, orders: 2 }]);
  });

  it("splits sales by weekday, payment, source, customer and product", async () => {
    const wednesday = 4; // Saturday first
    const b = await getSalesBreakdown(sellerId, FROM, TO, "sales");
    expect(b.byWeekday).toEqual(Array.from({ length: 7 }, (_, i) => (i === wednesday ? { orders: 2, sales: 3500 } : { orders: 0, sales: 0 })));
    expect(b.payment).toEqual([
      { key: "CARD_TO_CARD", orders: 1, sales: 2500 },
      { key: "ONLINE", orders: 1, sales: 1000 },
    ]);
    expect(b.source).toEqual([
      { key: "MANUAL", orders: 1, sales: 2500 },
      { key: "PURCHASE_LINK", orders: 1, sales: 1000 },
    ]);
    expect(b.topCustomers.map((c) => [c.customerId, c.name, c.orders, c.sales])).toEqual([
      [ids.c1, "مریم", 1, 2500],
      [ids.c2, null, 1, 1000],
    ]);
    expect(b.topProducts).toEqual([
      { productId: ids.a, name: "A", units: 3, sales: 3000 },
      { productId: ids.b, name: "B", units: 1, sales: 500 },
    ]);
    expect(b.units).toBe(4);
  });

  it("profit per product, over the lines that have a cost", async () => {
    expect(await getProductProfit(sellerId, FROM, TO)).toEqual([
      // A: 2 of its 3 units have a cost: 2000 − 1200 = 800 on 2000.
      { productId: ids.a, name: "A", costPrice: 600, units: 3, sales: 3000, cogs: 1200, costedSales: 2000, uncostedUnits: 1, grossProfit: 800, margin: 0.4 },
      { productId: ids.b, name: "B", costPrice: null, units: 1, sales: 500, cogs: 0, costedSales: 0, uncostedUnits: 1, grossProfit: null, margin: null },
    ]);
  });
});
