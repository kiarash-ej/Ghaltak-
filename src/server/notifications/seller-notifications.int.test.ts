import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hasTestDatabase } from "@/test/setup";
import {
  countUnreadNotifications,
  listNotifications,
  markNotificationsRead,
  notifyOrderEvent,
  notifySeller,
} from "./seller-notifications";

// In-app notifications against a real Postgres (TEST_DATABASE_URL).

describe.skipIf(!hasTestDatabase)("seller notifications (database)", () => {
  // Random, not the clock: DB test files start in parallel and share mobiles.
  const runId = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  let sellerId = "";
  let otherSellerId = "";
  let customerId = "";
  let productId = "";

  const newOrder = () =>
    prisma.order.create({
      data: {
        sellerId,
        customerId,
        source: "PURCHASE_LINK",
        totalPrice: 50_000,
        items: { create: { productId, quantity: 1, unitPrice: 50_000 } },
      },
    });

  beforeAll(async () => {
    sellerId = (await prisma.seller.create({ data: { name: "notif", mobile: `0986${runId}` } })).id;
    otherSellerId = (await prisma.seller.create({ data: { name: "other", mobile: `0985${runId}` } })).id;
    customerId = (await prisma.customer.create({ data: { sellerId, name: "سارا", phone: `0916${runId}` } })).id;
    productId = (await prisma.product.create({ data: { sellerId, name: "p", price: 50_000 } })).id;
  });
  afterAll(async () => {
    if (sellerId) {
      await prisma.order.deleteMany({ where: { sellerId } });
      await prisma.customer.deleteMany({ where: { sellerId } });
      await prisma.product.deleteMany({ where: { sellerId } });
    }
    await prisma.seller.deleteMany({ where: { id: { in: [sellerId, otherSellerId].filter(Boolean) } } });
    await prisma.$disconnect();
  });

  it("one notification per order event, however often it is triggered", async () => {
    const order = await newOrder();
    const results = await Promise.all([notifyOrderEvent("ORDER_NEW", order.id), notifyOrderEvent("ORDER_NEW", order.id)]);
    expect(results.sort()).toEqual(["created", "duplicate"]);

    const rows = await prisma.notification.findMany({ where: { orderId: order.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ sellerId, kind: "ORDER_NEW", ownerOnly: false, readAt: null });
    expect(rows[0].text).toContain("سارا");
    expect(rows[0].text).toContain(order.id.slice(-6).toUpperCase());
  });

  it("each uploaded receipt is its own event", async () => {
    const order = await newOrder();
    expect(await notifyOrderEvent("RECEIPT_UPLOADED", order.id, "receipts/a.png")).toBe("created");
    expect(await notifyOrderEvent("RECEIPT_UPLOADED", order.id, "receipts/a.png")).toBe("duplicate");
    expect(await notifyOrderEvent("RECEIPT_UPLOADED", order.id, "receipts/b.png")).toBe("created");
    expect(await prisma.notification.count({ where: { orderId: order.id } })).toBe(2);
  });

  it("an unknown order fails quietly", async () => {
    expect(await notifyOrderEvent("ORDER_NEW", "no-such-order")).toBe("failed");
  });

  it("operators don't see or clear the owner's notifications; stores don't see each other's", async () => {
    await prisma.notification.deleteMany({ where: { sellerId } });
    const order = await newOrder();
    await notifyOrderEvent("ORDER_NEW", order.id);
    await notifySeller({
      sellerId,
      kind: "SUBSCRIPTION_ENDING",
      text: "اشتراک",
      dedupeKey: `test-sub:${runId}`,
      ownerOnly: true,
    });

    expect(await countUnreadNotifications(sellerId, "OWNER")).toBe(2);
    expect(await countUnreadNotifications(sellerId, "OPERATOR")).toBe(1);
    expect(await countUnreadNotifications(otherSellerId, "OWNER")).toBe(0);
    expect((await listNotifications(sellerId, "OPERATOR")).map((n) => n.kind)).toEqual(["ORDER_NEW"]);
    expect(await listNotifications(otherSellerId, "OWNER")).toEqual([]);

    expect(await markNotificationsRead(sellerId, "OPERATOR")).toBe(1);
    expect(await countUnreadNotifications(sellerId, "OWNER")).toBe(1);
    expect(await markNotificationsRead(sellerId, "OWNER")).toBe(1);
    expect((await listNotifications(sellerId, "OWNER")).every((n) => !n.unread)).toBe(true);
  });
});
