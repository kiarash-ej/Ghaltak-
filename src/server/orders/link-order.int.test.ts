import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hasTestDatabase } from "@/test/setup";
import { prisma } from "@/lib/prisma";
import { QuotaError, placeLinkOrder } from "./link-order";
import { MAX_OPEN_ORDERS_PER_PHONE } from "./purchase-limits";

// Purchase-link orders against a real Postgres (TEST_DATABASE_URL).

describe.skipIf(!hasTestDatabase)("purchase-link orders (database)", () => {
  const runId = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  let sellerId = "";
  let linkId = "";
  let variantId = "";

  beforeAll(async () => {
    sellerId = (await prisma.seller.create({ data: { name: "link test", mobile: `0995${runId}` } })).id;
    const product = await prisma.product.create({
      data: { sellerId, name: "link product", price: 1000, variants: { create: { sellerId, stock: 100 } } },
      include: { variants: true },
    });
    variantId = product.variants[0].id;
    linkId = (
      await prisma.purchaseLink.create({
        data: { sellerId, token: `link-order-${runId}-xxxxxx`, products: { connect: { id: product.id } } },
      })
    ).id;
  });

  afterAll(async () => {
    if (!sellerId) return;
    await prisma.order.deleteMany({ where: { sellerId } });
    await prisma.purchaseLink.deleteMany({ where: { sellerId } });
    await prisma.customer.deleteMany({ where: { sellerId } });
    await prisma.product.deleteMany({ where: { sellerId } });
    await prisma.seller.delete({ where: { id: sellerId } });
    await prisma.$disconnect();
  });

  it("can't get past the per-phone limit with simultaneous requests (#18)", async () => {
    const phone = `0939${runId}`;
    const place = () =>
      placeLinkOrder(
        { linkId, sellerId },
        { name: "هم‌زمان", phone, address: "تهران، خیابان تست، پلاک ۳", items: [{ variantId, quantity: 1 }] },
      );

    const results = await Promise.allSettled(Array.from({ length: 8 }, place));

    const placed = results.filter((r) => r.status === "fulfilled");
    const refused = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(placed).toHaveLength(MAX_OPEN_ORDERS_PER_PHONE);
    for (const r of refused) expect(r.reason).toBeInstanceOf(QuotaError);

    // Exactly the placed orders exist, on one customer, and only they took stock.
    expect(await prisma.order.count({ where: { purchaseLinkId: linkId } })).toBe(MAX_OPEN_ORDERS_PER_PHONE);
    expect(await prisma.customer.count({ where: { sellerId, phone } })).toBe(1);
    const stock = (await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock;
    expect(stock).toBe(100 - MAX_OPEN_ORDERS_PER_PHONE);
  });
});
