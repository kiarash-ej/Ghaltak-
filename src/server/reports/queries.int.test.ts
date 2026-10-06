import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { OrderStatus } from "@/generated/prisma/enums";
import { hasTestDatabase } from "@/test/setup";
import { prisma } from "@/lib/prisma";
import { reportPeriods } from "./periods";
import { salesSince } from "./queries";

// salesSince against a small, hand-counted data set (TEST_DATABASE_URL).
//
// "Now" is Thursday 2 Mehr 1405, 20:23 Tehran (2026-09-24T16:53Z).
//   today starts  2026-09-23T20:30Z   (Tehran midnight)
//   week starts   2026-09-18T20:30Z   (Saturday)
//   month starts  2026-09-22T20:30Z   (1 Mehr)
// Product A costs 1000, product B 500.
//
//  #  customer  status           placed (UTC)          items     total  today week month
//  1  c1        DELIVERED        2026-09-24 10:00      A×2        2000    ✓    ✓    ✓
//  2  c2        PAID             2026-09-23 21:00      B×1         500    ✓    ✓    ✓   (00:30 Tehran)
//  3  c1        PENDING_PAYMENT  2026-09-24 10:00      A×1          -     not a sale
//  4  c3        CANCELED         2026-09-24 10:00      A×1          -     not a sale
//  5  c3        SHIPPED          2026-09-23 19:00      A×1 B×2    2000         ✓    ✓   (22:30 Tehran, 1 Mehr)
//  6  c2        PREPARING        2026-09-20 10:00      B×4        2000         ✓
//  7  c4        DELIVERED        2026-09-10 10:00      A×1        1000
//  8  c4        RETURNED         2026-09-24 10:00      A×1          -     not a sale
//  +  another seller's DELIVERED order today, which must never be counted

const NOW = new Date("2026-09-24T16:53:00Z");

describe.skipIf(!hasTestDatabase)("salesSince (database)", () => {
  const runId = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  let sellerId = "";
  let otherSellerId = "";

  beforeAll(async () => {
    sellerId = (await prisma.seller.create({ data: { name: "report test", mobile: `0993${runId}` } })).id;
    otherSellerId = (await prisma.seller.create({ data: { name: "other", mobile: `0994${runId}` } })).id;

    const product = (name: string, price: number) =>
      prisma.product.create({
        data: { sellerId, name, price, variants: { create: { sellerId, stock: 10 } } },
        include: { variants: true },
      });
    const a = await product("A", 1000);
    const b = await product("B", 500);

    const customer = (n: number) =>
      prisma.customer.create({ data: { sellerId, phone: `09${n}${runId}00`.slice(0, 11) } });
    const [c1, c2, c3, c4] = await Promise.all([customer(11), customer(12), customer(13), customer(14)]);

    const line = (p: typeof a, quantity: number) => ({
      productId: p.id,
      productVariantId: p.variants[0].id,
      quantity,
      unitPrice: p.price,
    });
    const order = (
      customerId: string,
      status: OrderStatus,
      createdAt: string,
      lines: ReturnType<typeof line>[],
    ) =>
      prisma.order.create({
        data: {
          sellerId,
          customerId,
          status,
          createdAt: new Date(createdAt),
          totalPrice: lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0),
          items: { create: lines },
        },
      });

    await order(c1.id, "DELIVERED", "2026-09-24T10:00:00Z", [line(a, 2)]);
    await order(c2.id, "PAID", "2026-09-23T21:00:00Z", [line(b, 1)]);
    await order(c1.id, "PENDING_PAYMENT", "2026-09-24T10:00:00Z", [line(a, 1)]);
    await order(c3.id, "CANCELED", "2026-09-24T10:00:00Z", [line(a, 1)]);
    await order(c3.id, "SHIPPED", "2026-09-23T19:00:00Z", [line(a, 1), line(b, 2)]);
    await order(c2.id, "PREPARING", "2026-09-20T10:00:00Z", [line(b, 4)]);
    await order(c4.id, "DELIVERED", "2026-09-10T10:00:00Z", [line(a, 1)]);
    await order(c4.id, "RETURNED", "2026-09-24T10:00:00Z", [line(a, 1)]);

    // Another seller's sale today: must not leak into this seller's totals.
    const otherCustomer = await prisma.customer.create({
      data: { sellerId: otherSellerId, phone: `0915${runId}` },
    });
    await prisma.order.create({
      data: {
        sellerId: otherSellerId,
        customerId: otherCustomer.id,
        status: "DELIVERED",
        createdAt: new Date("2026-09-24T10:00:00Z"),
        totalPrice: 99_999,
      },
    });
  });

  afterAll(async () => {
    if (!sellerId) return;
    const sellers = { in: [sellerId, otherSellerId] };
    await prisma.order.deleteMany({ where: { sellerId: sellers } });
    await prisma.customer.deleteMany({ where: { sellerId: sellers } });
    await prisma.product.deleteMany({ where: { sellerId: sellers } });
    await prisma.seller.deleteMany({ where: { id: sellers } });
    await prisma.$disconnect();
  });

  it("totals today, this week and this month in Tehran time", async () => {
    const periods = reportPeriods(NOW);
    expect(await salesSince(sellerId, periods.today)).toEqual({ total: 2500, count: 2, average: 1250 });
    expect(await salesSince(sellerId, periods.week)).toEqual({ total: 6500, count: 4, average: 1625 });
    expect(await salesSince(sellerId, periods.month)).toEqual({ total: 4500, count: 3, average: 1500 });
  });
});
