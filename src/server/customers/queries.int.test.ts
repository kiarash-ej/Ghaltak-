import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { OrderStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { hasTestDatabase } from "@/test/setup";
import { countByTag, getCustomerProfile, listCustomers } from "./queries";

// Runs against a real Postgres (TEST_DATABASE_URL). See docs/phase1/README.md.

describe.skipIf(!hasTestDatabase)("customer queries (database)", () => {
  const runId = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  let sellerId = "";
  let otherSellerId = "";
  let saraId = "";
  let aliId = "";

  beforeAll(async () => {
    sellerId = (await prisma.seller.create({ data: { name: "t", mobile: `0992${runId}` } })).id;
    otherSellerId = (await prisma.seller.create({ data: { name: "o", mobile: `0993${runId}` } })).id;

    const sara = await prisma.customer.create({
      data: { sellerId, name: "سارا احمدی", phone: "09121112233", tag: "LOYAL" },
    });
    const ali = await prisma.customer.create({ data: { sellerId, name: "علی", phone: "09354445566" } });
    // Same phone, different seller: must never show up for `sellerId`.
    await prisma.customer.create({ data: { sellerId: otherSellerId, name: "سارا دیگر", phone: "09121112233" } });
    saraId = sara.id;
    aliId = ali.id;

    const order = (customerId: string, status: OrderStatus, totalPrice: number) =>
      prisma.order.create({ data: { sellerId, customerId, status, totalPrice } });
    await order(sara.id, "DELIVERED", 1_000_000);
    await order(sara.id, "PAID", 500_000);
    await order(sara.id, "CANCELED", 9_000_000);
    await order(sara.id, "RETURNED", 7_000_000);
    await order(ali.id, "PENDING_PAYMENT", 300_000);
  });

  afterAll(async () => {
    if (!sellerId) return;
    await prisma.order.deleteMany({ where: { sellerId: { in: [sellerId, otherSellerId] } } });
    await prisma.customer.deleteMany({ where: { sellerId: { in: [sellerId, otherSellerId] } } });
    await prisma.seller.deleteMany({ where: { id: { in: [sellerId, otherSellerId] } } });
    await prisma.$disconnect();
  });

  it("computes stats from real orders, counting only paid purchases", async () => {
    const profile = await getCustomerProfile(sellerId, saraId);
    expect(profile?.stats).toMatchObject({
      orderCount: 4,
      purchaseCount: 2,
      totalSpent: 1_500_000,
      averageOrder: 750_000,
      returnCount: 1,
    });
    expect(profile?.orders).toHaveLength(4);
  });

  it("finds a customer by phone, including Persian digits and partial numbers", async () => {
    for (const q of ["09121112233", "۰۹۱۲۱۱۱", "1112233"]) {
      const { items } = await listCustomers(sellerId, { q });
      expect(items.map((c) => c.id)).toEqual([saraId]);
    }
  });

  it("finds by name and filters by tag", async () => {
    expect((await listCustomers(sellerId, { q: "علی" })).items.map((c) => c.id)).toEqual([aliId]);
    expect((await listCustomers(sellerId, { tag: "LOYAL" })).items.map((c) => c.id)).toEqual([saraId]);
  });

  it("gives list rows the same stats as the profile", async () => {
    const { items } = await listCustomers(sellerId, {});
    const ali = items.find((c) => c.id === aliId);
    expect(ali?.stats).toMatchObject({ orderCount: 1, purchaseCount: 0, totalSpent: 0 });
  });

  it("never shows another seller's customers or orders", async () => {
    const { items, total } = await listCustomers(sellerId, { q: "سارا" });
    expect(total).toBe(1);
    expect(items[0].name).toBe("سارا احمدی");
    expect(await getCustomerProfile(otherSellerId, saraId)).toBeNull();
    expect(await countByTag(sellerId)).toEqual({ NEW: 1, LOYAL: 1, INACTIVE: 0, total: 2 });
  });
});
