import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createOrderInTx } from "@/server/orders/create-order";
import { hasTestDatabase } from "@/test/setup";
import { countLinesWithoutCost, fillMissingCosts } from "./costs";

// Cost prices on order lines (finance spec §6.1), against a real database.
// An order copies the product's cost when it is placed; a later change of the
// product's cost never rewrites it; «use for past sales» fills only lines
// without a cost, of that product, in that seller's orders.

describe.skipIf(!hasTestDatabase)("cost prices on order lines (database)", () => {
  const runId = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  let sellerId = "";
  let otherSellerId = "";
  let productId = "";
  let variantId = "";
  let otherProductId = "";

  const placeOrder = (forSeller: string, variant: string) =>
    prisma.$transaction((tx) =>
      createOrderInTx(tx, {
        sellerId: forSeller,
        customer: { kind: "new", name: "cost test", phone: `0936${runId}` },
        shippingAddress: "test",
        items: [{ variantId: variant, quantity: 2 }],
        source: "MANUAL",
      }),
    );
  const unitCostsOf = async (orderId: string) =>
    (await prisma.orderItem.findMany({ where: { orderId }, select: { unitCost: true } })).map((l) => l.unitCost);

  beforeAll(async () => {
    sellerId = (await prisma.seller.create({ data: { name: "cost test", mobile: `0984${runId}` } })).id;
    otherSellerId = (await prisma.seller.create({ data: { name: "other", mobile: `0985${runId}` } })).id;
    const product = await prisma.product.create({
      data: { sellerId, name: "مانتو", price: 1000, variants: { create: { sellerId, stock: 50 } } },
      include: { variants: true },
    });
    productId = product.id;
    variantId = product.variants[0].id;
    otherProductId = (
      await prisma.product.create({ data: { sellerId, name: "شال", price: 500, variants: { create: { sellerId, stock: 50 } } } })
    ).id;
  });

  afterAll(async () => {
    const sellers = { sellerId: { in: [sellerId, otherSellerId] } };
    await prisma.order.deleteMany({ where: sellers });
    await prisma.stockMovement.deleteMany({ where: { variant: sellers } });
    await prisma.productVariant.deleteMany({ where: sellers });
    await prisma.product.deleteMany({ where: sellers });
    await prisma.customer.deleteMany({ where: sellers });
    await prisma.seller.deleteMany({ where: { id: { in: [sellerId, otherSellerId] } } });
  });

  it("a product without a cost gives its lines no cost (never a guess)", async () => {
    const { id } = await placeOrder(sellerId, variantId);
    expect(await unitCostsOf(id)).toEqual([null]);
  });

  it("an order copies the product's cost, and a later cost change doesn't rewrite it", async () => {
    await prisma.product.update({ where: { id: productId }, data: { costPrice: 600 } });
    const { id } = await placeOrder(sellerId, variantId);
    expect(await unitCostsOf(id)).toEqual([600]);

    await prisma.product.update({ where: { id: productId }, data: { costPrice: 900 } });
    expect(await unitCostsOf(id)).toEqual([600]);
  });

  it("«use for past sales» fills only this product's lines without a cost, in this seller's orders", async () => {
    // State: one line without a cost (first test), one at 600 (second test).
    // Another product's line without a cost, and another seller's line on the
    // same product id must stay as they are.
    const otherProductOrder = await prisma.$transaction(async (tx) => {
      const v = await tx.productVariant.findFirstOrThrow({ where: { productId: otherProductId } });
      return createOrderInTx(tx, {
        sellerId,
        customer: { kind: "new", name: "cost test", phone: `0936${runId}` },
        shippingAddress: "test",
        items: [{ variantId: v.id, quantity: 1 }],
        source: "MANUAL",
      });
    });
    const otherCustomer = await prisma.customer.create({ data: { sellerId: otherSellerId, phone: `0937${runId}` } });
    // A line in another seller's order pointing at this product (not possible
    // through the app; proves the seller scope of the update).
    const foreign = await prisma.order.create({
      data: {
        sellerId: otherSellerId,
        customerId: otherCustomer.id,
        totalPrice: 1000,
        items: { create: { productId, quantity: 1, unitPrice: 1000 } },
      },
    });

    expect(await countLinesWithoutCost(sellerId, productId)).toBe(1);
    const filled = await prisma.$transaction((tx) => fillMissingCosts(tx, sellerId, productId, 900));
    expect(filled).toBe(1);

    const lines = await prisma.orderItem.findMany({
      where: { productId, order: { sellerId } },
      orderBy: { unitCost: "asc" },
      select: { unitCost: true },
    });
    expect(lines.map((l) => l.unitCost)).toEqual([600, 900]);
    expect(await unitCostsOf(otherProductOrder.id)).toEqual([null]);
    expect(await unitCostsOf(foreign.id)).toEqual([null]);
    expect(await countLinesWithoutCost(sellerId, productId)).toBe(0);
  });
});
