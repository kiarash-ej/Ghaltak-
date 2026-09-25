import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { OrderStatus } from "@/generated/prisma/enums";
import { hasTestDatabase } from "@/test/setup";
import { prisma } from "@/lib/prisma";
import { recordLinkView } from "@/server/orders/link-views";
import { getLinkFunnel } from "./link-funnel";

// The purchase-link funnel (B8) against a small, hand-counted data set.
//
// "Now" is Thursday 2 Mehr 1405, 20:23 Tehran (2026-09-24T16:53Z).
// This month started on 1 Mehr = Tehran day 2026-09-23 (2026-09-22T20:30Z).
//
// Views (Tehran day → count):
//   L1  2026-09-22 (31 Shahrivar) 7   last month, not counted
//       2026-09-23 (1 Mehr)       4 + 1 recorded at 00:15 Tehran = 5
//       2026-09-24 (2 Mehr)       3 recorded at the same moment
//   L2  2026-09-24                2
//   LX  2026-09-24                9   another seller's link
//
// Orders (placed UTC):
//   L1  PAID             2026-09-24 10:00   order, paid
//   L1  DELIVERED        2026-09-23 19:00   order, paid   (22:30 Tehran, 1 Mehr)
//   L1  PENDING_PAYMENT  2026-09-24 10:00   order
//   L1  CANCELED         2026-09-24 10:00   order
//   L1  PAID             2026-09-22 20:00   last month    (23:30 Tehran, 31 Shahrivar)
//   L2  RETURNED         2026-09-24 10:00   order (a return is not a sale)
//   --  DELIVERED manual 2026-09-24 10:00   no link, not in the funnel
//   LX  DELIVERED        2026-09-24 10:00   another seller's
//
// Expected:  L1  8 views  4 orders  2 paid  25%
//            L2  2 views  1 order   0 paid   0%
//            L3  0 views  0 orders  0 paid   no rate (nothing to divide by)
//            all 10 views 5 orders  2 paid  20%

const NOW = new Date("2026-09-24T16:53:00Z");

describe.skipIf(!hasTestDatabase)("purchase-link funnel (database)", () => {
  const runId = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  let sellerId = "";
  let otherSellerId = "";
  let l1 = "";
  let l2 = "";
  let l3 = "";
  let lx = "";

  beforeAll(async () => {
    sellerId = (await prisma.seller.create({ data: { name: "funnel test", mobile: `0995${runId}` } })).id;
    otherSellerId = (await prisma.seller.create({ data: { name: "other", mobile: `0996${runId}` } })).id;

    const link = (owner: string, title: string, createdAt: string, isActive = true) =>
      prisma.purchaseLink.create({
        data: { sellerId: owner, title, isActive, createdAt: new Date(createdAt), token: `funnel-${title}-${runId}-xxxxxx` },
      });
    l1 = (await link(sellerId, "L1", "2026-09-01T10:00:00Z")).id;
    l2 = (await link(sellerId, "L2", "2026-09-02T10:00:00Z", false)).id;
    l3 = (await link(sellerId, "L3", "2026-09-03T10:00:00Z")).id;
    lx = (await link(otherSellerId, "LX", "2026-09-01T10:00:00Z")).id;

    const views = (purchaseLinkId: string, day: string, count: number) =>
      prisma.linkDailyView.create({ data: { purchaseLinkId, day: new Date(`${day}T00:00:00Z`), views: count } });
    await views(l1, "2026-09-22", 7);
    await views(l1, "2026-09-23", 4);
    await views(l2, "2026-09-24", 2);
    await views(lx, "2026-09-24", 9);
    // 00:15 Tehran on 1 Mehr: still UTC 22 September, but Tehran's 23rd.
    await recordLinkView(l1, new Date("2026-09-22T20:45:00Z"));
    // Three visitors at once: no increment may be lost.
    await Promise.all([1, 2, 3].map(() => recordLinkView(l1, NOW)));

    const customer = await prisma.customer.create({ data: { sellerId, phone: `0917${runId}` } });
    const otherCustomer = await prisma.customer.create({ data: { sellerId: otherSellerId, phone: `0918${runId}` } });
    const order = (
      owner: string,
      customerId: string,
      purchaseLinkId: string | null,
      status: OrderStatus,
      createdAt: string,
    ) =>
      prisma.order.create({
        data: {
          sellerId: owner,
          customerId,
          purchaseLinkId,
          source: purchaseLinkId ? "PURCHASE_LINK" : "MANUAL",
          status,
          totalPrice: 1000,
          createdAt: new Date(createdAt),
        },
      });
    await order(sellerId, customer.id, l1, "PAID", "2026-09-24T10:00:00Z");
    await order(sellerId, customer.id, l1, "DELIVERED", "2026-09-23T19:00:00Z");
    await order(sellerId, customer.id, l1, "PENDING_PAYMENT", "2026-09-24T10:00:00Z");
    await order(sellerId, customer.id, l1, "CANCELED", "2026-09-24T10:00:00Z");
    await order(sellerId, customer.id, l1, "PAID", "2026-09-22T20:00:00Z");
    await order(sellerId, customer.id, l2, "RETURNED", "2026-09-24T10:00:00Z");
    await order(sellerId, customer.id, null, "DELIVERED", "2026-09-24T10:00:00Z");
    await order(otherSellerId, otherCustomer.id, lx, "DELIVERED", "2026-09-24T10:00:00Z");
  });

  afterAll(async () => {
    const sellers = { sellerId: { in: [sellerId, otherSellerId] } };
    await prisma.order.deleteMany({ where: sellers });
    await prisma.customer.deleteMany({ where: sellers });
    await prisma.purchaseLink.deleteMany({ where: sellers }); // views go with them (cascade)
    await prisma.seller.deleteMany({ where: { id: { in: [sellerId, otherSellerId] } } });
  });

  it("stores views per Tehran day, without losing concurrent ones", async () => {
    const rows = await prisma.linkDailyView.findMany({
      where: { purchaseLinkId: l1 },
      orderBy: { day: "asc" },
      select: { day: true, views: true },
    });
    expect(rows.map((r) => [r.day.toISOString().slice(0, 10), r.views])).toEqual([
      ["2026-09-22", 7],
      ["2026-09-23", 5],
      ["2026-09-24", 3],
    ]);
  });

  it("counts this month's views, orders and paid orders per link, only this seller's", async () => {
    const funnel = await getLinkFunnel(sellerId, NOW);
    expect(funnel.since).toEqual(new Date("2026-09-22T20:30:00Z"));

    const byTitle = Object.fromEntries(
      funnel.links.map((l) => [l.title, [l.views, l.orders, l.paid, l.conversion]]),
    );
    expect(byTitle).toEqual({
      L1: [8, 4, 2, 0.25],
      L2: [2, 1, 0, 0],
      L3: [0, 0, 0, null],
    });
    expect(funnel.links.map((l) => l.linkId).sort()).toEqual([l1, l2, l3].sort());
    expect(funnel.links.find((l) => l.linkId === l2)?.isActive).toBe(false);
    expect(funnel.total).toEqual({ views: 10, orders: 5, paid: 2, conversion: 0.2 });
  });

  it("puts the busiest links first", async () => {
    const funnel = await getLinkFunnel(sellerId, NOW);
    expect(funnel.links.map((l) => l.title)).toEqual(["L1", "L2", "L3"]);
  });

  it("has nothing for a seller without links", async () => {
    const empty = await prisma.seller.create({ data: { name: "empty", mobile: `0997${runId}` } });
    try {
      const funnel = await getLinkFunnel(empty.id, NOW);
      expect(funnel.links).toEqual([]);
      expect(funnel.total).toEqual({ views: 0, orders: 0, paid: 0, conversion: null });
    } finally {
      await prisma.seller.delete({ where: { id: empty.id } });
    }
  });

  it("never breaks the buy page: a failed count is logged and swallowed", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(recordLinkView("no-such-link", NOW)).resolves.toBeUndefined();
      expect(log).toHaveBeenCalledOnce();
    } finally {
      log.mockRestore();
    }
  });
});
