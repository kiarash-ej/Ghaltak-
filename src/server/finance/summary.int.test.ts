import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { OrderStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { hasTestDatabase } from "@/test/setup";
import { getFinanceSeries, getFinanceTotals, getUnpaid } from "./summary";

// The finance numbers (spec §6.2) against a hand-counted data set.
//
// Range: 1 Mehr 00:00 → 3 Mehr 00:00 Tehran (2026-09-22T20:30Z → 2026-09-24T20:30Z),
// i.e. the Tehran days 2026-09-23 (1 Mehr) and 2026-09-24 (2 Mehr).
//
//  order  status           placed (UTC)        lines (qty × price, cost)         in range
//  o1     DELIVERED        2026-09-23 10:00    2 × 1000 @600, 1 × 500 @200       ✓ sale
//  o2     PAID             2026-09-22 21:00    1 × 3000, no cost                 ✓ sale (00:30 Tehran)
//  o3     PENDING_PAYMENT  2026-09-24 10:00    1 × 9000                          ✓ order, not a sale (unpaid 9000 + 500 shipping)
//  o4     CANCELED         2026-09-24 10:00    1 × 7000                          ✓ order, canceled
//  o5     RETURNED         2026-09-24 10:00    1 × 4000                          ✓ order, returned
//  o6     DELIVERED        2026-09-22 19:00    1 × 8000                          ✗ (22:30 Tehran, 31 Shahrivar)
//  o7     PAID             2026-09-24 21:00    1 × 6000                          ✗ (00:30 Tehran on 3 Mehr)
//
// Sales = 2500 + 3000 = 5500 from 2 orders; COGS = 2×600 + 1×200 = 1400 on
// covered sales of 2500 → coverage 2500/5500; gross = 4100.
// Expenses (Tehran days): 1 Mehr ADS 300, 2 Mehr RENT 1000, 2 Mehr voided 999 ✗,
// 3 Mehr 50 ✗, 31 Shahrivar 70 ✗ → 1300. Net = 4100 − 1300 = 2800.
// Orders placed in range: o1–o5 = 5; returned 1 → return rate 1/(2+1);
// canceled 1 → cancel rate 1/5. AOV 5500/2 = 2750.
// Another seller's sale and expense in range must never count.

const FROM = new Date("2026-09-22T20:30:00Z");
const TO = new Date("2026-09-24T20:30:00Z");

describe.skipIf(!hasTestDatabase)("finance numbers (database)", () => {
  const runId = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  let sellerId = "";
  let otherSellerId = "";

  beforeAll(async () => {
    sellerId = (await prisma.seller.create({ data: { name: "finance", mobile: `0982${runId}` } })).id;
    otherSellerId = (await prisma.seller.create({ data: { name: "other", mobile: `0983${runId}` } })).id;
    const a = await prisma.product.create({ data: { sellerId, name: "A", price: 1000 } });
    const b = await prisma.product.create({ data: { sellerId, name: "B", price: 500 } });
    const x = await prisma.product.create({ data: { sellerId: otherSellerId, name: "X", price: 1 } });
    const c = await prisma.customer.create({ data: { sellerId, phone: `0914${runId}` } });
    const oc = await prisma.customer.create({ data: { sellerId: otherSellerId, phone: `0915${runId}` } });

    type Line = { productId: string; quantity: number; unitPrice: number; unitCost?: number | null };
    const order = (owner: string, customerId: string, status: OrderStatus, createdAt: string, lines: Line[], shippingCost?: number) =>
      prisma.order.create({
        data: {
          sellerId: owner,
          customerId,
          status,
          createdAt: new Date(createdAt),
          shippingCost,
          totalPrice: lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0),
          items: { create: lines.map((l) => ({ ...l, unitCost: l.unitCost ?? null })) },
        },
      });
    await order(sellerId, c.id, "DELIVERED", "2026-09-23T10:00:00Z", [
      { productId: a.id, quantity: 2, unitPrice: 1000, unitCost: 600 },
      { productId: b.id, quantity: 1, unitPrice: 500, unitCost: 200 },
    ]);
    await order(sellerId, c.id, "PAID", "2026-09-22T21:00:00Z", [{ productId: a.id, quantity: 1, unitPrice: 3000 }]);
    await order(sellerId, c.id, "PENDING_PAYMENT", "2026-09-24T10:00:00Z", [{ productId: a.id, quantity: 1, unitPrice: 9000 }], 500);
    await order(sellerId, c.id, "CANCELED", "2026-09-24T10:00:00Z", [{ productId: a.id, quantity: 1, unitPrice: 7000 }]);
    await order(sellerId, c.id, "RETURNED", "2026-09-24T10:00:00Z", [{ productId: a.id, quantity: 1, unitPrice: 4000 }]);
    await order(sellerId, c.id, "DELIVERED", "2026-09-22T19:00:00Z", [{ productId: a.id, quantity: 1, unitPrice: 8000 }]);
    await order(sellerId, c.id, "PAID", "2026-09-24T21:00:00Z", [{ productId: a.id, quantity: 1, unitPrice: 6000 }]);
    await order(otherSellerId, oc.id, "DELIVERED", "2026-09-23T10:00:00Z", [{ productId: x.id, quantity: 1, unitPrice: 99000, unitCost: 1 }]);

    const expense = (owner: string, day: string, amount: number, category: "ADS" | "RENT" = "ADS", voided = false) =>
      prisma.expense.create({
        data: { sellerId: owner, category, amount, spentOn: new Date(`${day}T00:00:00Z`), voidedAt: voided ? new Date() : null },
      });
    await expense(sellerId, "2026-09-23", 300);
    await expense(sellerId, "2026-09-24", 1000, "RENT");
    await expense(sellerId, "2026-09-24", 999, "ADS", true);
    await expense(sellerId, "2026-09-25", 50);
    await expense(sellerId, "2026-09-22", 70);
    await expense(otherSellerId, "2026-09-23", 88888);
  });

  afterAll(async () => {
    const sellers = { sellerId: { in: [sellerId, otherSellerId] } };
    await prisma.expense.deleteMany({ where: sellers });
    await prisma.order.deleteMany({ where: sellers });
    await prisma.product.deleteMany({ where: sellers });
    await prisma.customer.deleteMany({ where: sellers });
    await prisma.seller.deleteMany({ where: { id: { in: [sellerId, otherSellerId] } } });
  });

  it("adds up sales, cost of goods, expenses and profit by the definitions", async () => {
    expect(await getFinanceTotals(sellerId, FROM, TO)).toEqual({
      sales: 5500,
      saleOrders: 2,
      cogs: 1400,
      coverage: 2500 / 5500,
      grossProfit: 4100,
      expenses: 1300,
      netProfit: 2800,
      margin: 2800 / 5500,
      averageOrder: 2750,
      ordersPlaced: 5,
      returnRate: 1 / 3,
      cancelRate: 1 / 5,
    });
  });

  it("gives each Tehran day its sales and net profit", async () => {
    const series = await getFinanceSeries(sellerId, FROM, TO);
    expect(series).toEqual([
      // 1 Mehr: o1 (2500, cost 1400) + o2 (3000, no cost) − 300 ads.
      { key: "2026-09-23", sales: 5500, net: 5500 - 1400 - 300 },
      // 2 Mehr: no sales, 1000 rent.
      { key: "2026-09-24", sales: 0, net: -1000 },
    ]);
  });

  it("has no rates without a base, never a division by zero", async () => {
    const empty = await getFinanceTotals(sellerId, new Date("2020-01-01T00:00:00Z"), new Date("2020-01-02T00:00:00Z"));
    expect(empty).toMatchObject({ sales: 0, coverage: null, margin: null, averageOrder: null, returnRate: null, cancelRate: null });
  });

  it("counts what customers still owe, whatever the period", async () => {
    expect(await getUnpaid(sellerId)).toEqual({ orders: 1, amount: 9500 });
  });
});
