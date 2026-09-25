import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { OrderStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { DEFAULT_STORE_NAME } from "@/server/account";
import { hasTestDatabase } from "@/test/setup";
import { getOnboardingFacts, getTodaySummary } from "./queries";

// The dashboard home against a real Postgres (TEST_DATABASE_URL).
//
// "Now" is Thursday 2 Mehr 1405, 20:23 Tehran (2026-09-24T16:53Z); today
// started at 2026-09-23T20:30Z. Another seller has one of everything, and none
// of it may show up in this seller's numbers.

const NOW = new Date("2026-09-24T16:53:00Z");

describe.skipIf(!hasTestDatabase)("dashboard home (database)", () => {
  const runId = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  let sellerId = "";
  let otherSellerId = "";

  async function everything(forSellerId: string, phone: string) {
    const product = await prisma.product.create({
      data: { sellerId: forSellerId, name: "p", price: 1000, variants: { create: { sellerId: forSellerId, stock: 0 } } },
    });
    await prisma.purchaseLink.create({
      data: { sellerId: forSellerId, token: `home-${forSellerId}-xxxxxxxxxx`, products: { connect: { id: product.id } } },
    });
    const customer = await prisma.customer.create({ data: { sellerId: forSellerId, phone } });
    return { product, customer };
  }

  function order(forSellerId: string, customerId: string, status: OrderStatus, createdAt: string, receipt = false) {
    return prisma.order.create({
      data: {
        sellerId: forSellerId,
        customerId,
        status,
        totalPrice: 1000,
        createdAt: new Date(createdAt),
        receiptImageUrl: receipt ? "receipts/x.png" : null,
      },
    });
  }

  beforeAll(async () => {
    sellerId = (await prisma.seller.create({ data: { mobile: `0990${runId}`, name: DEFAULT_STORE_NAME } })).id;
    otherSellerId = (
      await prisma.seller.create({
        data: {
          mobile: `0991${runId}`,
          name: "فروشگاه دیگر",
          instagram: "other.shop",
          cardNumberEncrypted: "v1.not-a-real-secret",
        },
      })
    ).id;
    const other = await everything(otherSellerId, `0936${runId}`);
    await order(otherSellerId, other.customer.id, "PENDING_PAYMENT", "2026-09-24T10:00:00Z", true);
    await order(otherSellerId, other.customer.id, "PAID", "2026-09-24T10:00:00Z");
  });

  afterAll(async () => {
    const sellerIds = [sellerId, otherSellerId].filter(Boolean);
    await prisma.order.deleteMany({ where: { sellerId: { in: sellerIds } } });
    await prisma.purchaseLink.deleteMany({ where: { sellerId: { in: sellerIds } } });
    await prisma.customer.deleteMany({ where: { sellerId: { in: sellerIds } } });
    await prisma.productVariant.deleteMany({ where: { sellerId: { in: sellerIds } } });
    await prisma.product.deleteMany({ where: { sellerId: { in: sellerIds } } });
    await prisma.seller.deleteMany({ where: { id: { in: sellerIds } } });
    await prisma.$disconnect();
  });

  it("a new seller has no step done and all-zero numbers, whatever other sellers have", async () => {
    expect(await getOnboardingFacts(sellerId)).toEqual({
      storeComplete: false,
      hasProduct: false,
      hasCard: false,
      hasPurchaseLink: false,
      hasOrder: false,
    });
    expect(await getTodaySummary(sellerId, NOW)).toEqual({
      ordersToday: 0,
      salesToday: { total: 0, count: 0, average: 0 },
      pendingReceipts: 0,
      needsRestock: 0,
    });
  });

  it("the store step needs a real name AND a contact", async () => {
    await prisma.seller.update({ where: { id: sellerId }, data: { name: "بوتیک آزمایشی" } });
    expect((await getOnboardingFacts(sellerId)).storeComplete).toBe(false);

    await prisma.seller.update({ where: { id: sellerId }, data: { telegram: "test_shop" } });
    expect((await getOnboardingFacts(sellerId)).storeComplete).toBe(true);

    await prisma.seller.update({ where: { id: sellerId }, data: { name: DEFAULT_STORE_NAME } });
    expect((await getOnboardingFacts(sellerId)).storeComplete).toBe(false);
  });

  it("ticks card, product, link and order from this seller's own rows", async () => {
    await prisma.seller.update({ where: { id: sellerId }, data: { cardNumberEncrypted: "v1.not-a-real-secret" } });
    const { customer } = await everything(sellerId, `0937${runId}`);
    await order(sellerId, customer.id, "PENDING_PAYMENT", "2026-09-20T10:00:00Z");

    expect(await getOnboardingFacts(sellerId)).toMatchObject({
      hasProduct: true,
      hasCard: true,
      hasPurchaseLink: true,
      hasOrder: true,
    });
  });

  it("counts today's orders, today's sales, waiting receipts and restock by the owners' rules", async () => {
    await prisma.order.deleteMany({ where: { sellerId } });
    const customerId = (await prisma.customer.findFirstOrThrow({ where: { sellerId } })).id;
    // Today (Tehran): four orders, two of them sales.
    await order(sellerId, customerId, "PAID", "2026-09-24T10:00:00Z");
    await order(sellerId, customerId, "DELIVERED", "2026-09-23T21:00:00Z"); // 00:30 Tehran, today
    await order(sellerId, customerId, "PENDING_PAYMENT", "2026-09-24T12:00:00Z", true); // receipt waiting
    await order(sellerId, customerId, "CANCELED", "2026-09-24T12:00:00Z", true); // receipt, but canceled
    // Yesterday in Tehran (22:30 on 1 Mehr): neither today's order nor sale, but its receipt waits.
    await order(sellerId, customerId, "PENDING_PAYMENT", "2026-09-23T19:00:00Z", true);

    // Restock: the product from the previous test (stock 0, active) plus an
    // inactive one at 0, which doesn't need restocking (#19).
    await prisma.product.create({
      data: { sellerId, name: "off", price: 1, isActive: false, variants: { create: { sellerId, stock: 0 } } },
    });

    expect(await getTodaySummary(sellerId, NOW)).toEqual({
      ordersToday: 4,
      salesToday: { total: 2000, count: 2, average: 1000 },
      pendingReceipts: 2,
      needsRestock: 1,
    });
  });
});
