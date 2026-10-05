import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { OrderStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { hasTestDatabase } from "@/test/setup";
import { getDailyBrief } from "./brief";

// The daily brief (spec §7.1) against a hand-counted data set.
//
// "Now" is Tuesday 14 Mehr 1405, 10:00 Tehran (2026-10-06T06:30Z).
// Yesterday = Monday 13 Mehr = Tehran day 2026-10-05 (2026-10-04T20:30Z → 2026-10-05T20:30Z).
// Same weekday last week = Monday 6 Mehr = 2026-09-28.
//
//  placed (UTC)          status           total   counts as
//  2026-10-05 10:00      DELIVERED        4000    yesterday: sale + order
//  2026-10-04 20:45      PAID             2400    yesterday (00:15 Tehran): sale + order
//  2026-10-05 12:00      PENDING_PAYMENT  9000    yesterday: order, not a sale
//  2026-10-05 12:00      CANCELED         7000    yesterday: order, not a sale
//  2026-10-04 20:15      PAID             1000    the day before (23:45 Tehran, 12 Mehr)
//  2026-10-06 05:00      PAID             8000    today: not in yesterday
//  2026-09-28 10:00      SHIPPED          5000    last Monday
//  +  another seller's sale yesterday, never counted
//
// Expected: yesterday sales 6400 from 4 orders; last Monday 5000; the 7 days
// ending yesterday (7–13 Mehr) have 12 Mehr = 1000 and 13 Mehr = 6400, the
// rest 0 (today's sale is not in the brief).

const NOW = new Date("2026-10-06T06:30:00Z");

describe.skipIf(!hasTestDatabase)("daily brief (database)", () => {
  const runId = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  let sellerId = "";
  let otherSellerId = "";

  beforeAll(async () => {
    sellerId = (await prisma.seller.create({ data: { name: "brief", mobile: `0988${runId}` } })).id;
    otherSellerId = (await prisma.seller.create({ data: { name: "other", mobile: `0989${runId}` } })).id;
    const c = await prisma.customer.create({ data: { sellerId, phone: `0912${runId}` } });
    const oc = await prisma.customer.create({ data: { sellerId: otherSellerId, phone: `0913${runId}` } });
    const order = (owner: string, customerId: string, status: OrderStatus, createdAt: string, totalPrice: number) =>
      prisma.order.create({ data: { sellerId: owner, customerId, status, totalPrice, createdAt: new Date(createdAt) } });
    await order(sellerId, c.id, "DELIVERED", "2026-10-05T10:00:00Z", 4000);
    await order(sellerId, c.id, "PAID", "2026-10-04T20:45:00Z", 2400);
    await order(sellerId, c.id, "PENDING_PAYMENT", "2026-10-05T12:00:00Z", 9000);
    await order(sellerId, c.id, "CANCELED", "2026-10-05T12:00:00Z", 7000);
    await order(sellerId, c.id, "PAID", "2026-10-04T20:15:00Z", 1000);
    await order(sellerId, c.id, "PAID", "2026-10-06T05:00:00Z", 8000);
    await order(sellerId, c.id, "SHIPPED", "2026-09-28T10:00:00Z", 5000);
    await order(otherSellerId, oc.id, "DELIVERED", "2026-10-05T10:00:00Z", 99000);
  });

  afterAll(async () => {
    const sellers = { sellerId: { in: [sellerId, otherSellerId] } };
    await prisma.order.deleteMany({ where: sellers });
    await prisma.customer.deleteMany({ where: sellers });
    await prisma.seller.deleteMany({ where: { id: { in: [sellerId, otherSellerId] } } });
  });

  it("sums yesterday by the Tehran day, only this seller's", async () => {
    const brief = await getDailyBrief(sellerId, NOW);
    expect(brief).toMatchObject({
      dayKey: "2026-10-06",
      yesterdayWeekday: "دوشنبه",
      sales: 6400,
      orders: 4,
      lastWeekSales: 5000,
      hasSales: true,
    });
  });

  it("gives the 7 days ending yesterday, oldest first", async () => {
    const brief = await getDailyBrief(sellerId, NOW);
    expect(brief.week.map((d) => d.total)).toEqual([0, 0, 0, 0, 0, 1000, 6400]);
    expect(brief.week.at(-1)?.key).toBe("2026-10-05");
  });

  it("a store without a single sale has no brief to show", async () => {
    const empty = await prisma.seller.create({ data: { name: "empty", mobile: `0987${runId}` } });
    try {
      expect((await getDailyBrief(empty.id, NOW)).hasSales).toBe(false);
    } finally {
      await prisma.seller.delete({ where: { id: empty.id } });
    }
  });
});
