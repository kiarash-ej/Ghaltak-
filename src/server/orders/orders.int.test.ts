import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { hasTestDatabase } from "@/test/setup";
import { prisma } from "@/lib/prisma";
import { OrderError, createOrderInTx } from "./create-order";
import { expireUnpaidLinkOrders } from "./expire-orders";
import { OutOfStockError, returnStock } from "./stock";

// Orders against a real Postgres with Track A's real adjustStock
// (TEST_DATABASE_URL, see docs/phase1/README.md).

describe.skipIf(!hasTestDatabase)("orders and stock (database)", () => {
  const runId = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  let sellerId = "";
  let productId = "";
  let variantId = "";
  let linkId = "";

  const stockOf = async () =>
    (await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock;
  const movementsFor = (orderId: string) =>
    prisma.stockMovement.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });

  function order(quantity: number, opts: { phone?: string; purchaseLinkId?: string } = {}) {
    return prisma.$transaction((tx) =>
      createOrderInTx(tx, {
        sellerId,
        customer: { kind: "new", name: "test", phone: opts.phone ?? `0935${runId}` },
        shippingAddress: "test address",
        items: [{ variantId, quantity }],
        source: opts.purchaseLinkId ? "PURCHASE_LINK" : "MANUAL",
        purchaseLinkId: opts.purchaseLinkId,
      }),
    );
  }

  beforeAll(async () => {
    sellerId = (await prisma.seller.create({ data: { name: "orders test", mobile: `0992${runId}` } })).id;
    const product = await prisma.product.create({ data: { sellerId, name: "test product", price: 1000 } });
    productId = product.id;
    variantId = (
      await prisma.productVariant.create({ data: { sellerId, productId: product.id, stock: 0 } })
    ).id;
    linkId = (
      await prisma.purchaseLink.create({
        data: { sellerId, token: `test-link-${runId}-xxxxxxxx`, products: { connect: { id: product.id } } },
      })
    ).id;
  });

  beforeEach(async () => {
    await prisma.order.deleteMany({ where: { sellerId } });
    await prisma.stockMovement.deleteMany({ where: { variantId } });
    await prisma.productVariant.update({ where: { id: variantId }, data: { stock: 5 } });
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

  it("takes stock when an order is created and logs it against the order", async () => {
    const { id } = await order(2);
    expect(await stockOf()).toBe(3);
    const log = await movementsFor(id);
    expect(log.map((m) => [m.delta, m.reason])).toEqual([[-2, "ORDER_PLACED"]]);
  });

  it("gives stock back on cancel, exactly once", async () => {
    const { id } = await order(2);
    await prisma.$transaction((tx) => returnStock(id, "ORDER_CANCELED", tx));
    await prisma.$transaction((tx) => returnStock(id, "ORDER_CANCELED", tx));
    expect(await stockOf()).toBe(5);
    const log = await movementsFor(id);
    expect(log.map((m) => [m.delta, m.reason])).toEqual([
      [-2, "ORDER_PLACED"],
      [2, "ORDER_CANCELED"],
    ]);
  });

  it("logs a return as ORDER_RETURNED", async () => {
    const { id } = await order(1);
    await prisma.$transaction((tx) => returnStock(id, "ORDER_RETURNED", tx));
    expect((await movementsFor(id)).at(-1)?.reason).toBe("ORDER_RETURNED");
    expect(await stockOf()).toBe(5);
  });

  it("gives nothing back for an order that never took stock (created under the stub)", async () => {
    const customer = await prisma.customer.create({ data: { sellerId, phone: `0936${runId}` } });
    const old = await prisma.order.create({
      data: {
        sellerId,
        customerId: customer.id,
        totalPrice: 2000,
        items: { create: { productId, productVariantId: variantId, quantity: 2, unitPrice: 1000 } },
      },
    });
    await prisma.$transaction((tx) => returnStock(old.id, "ORDER_CANCELED", tx));
    expect(await stockOf()).toBe(5);
  });

  it("refuses an order for more than is in stock and changes nothing", async () => {
    await expect(order(6)).rejects.toBeInstanceOf(OrderError);
    expect(await stockOf()).toBe(5);
    expect(await prisma.order.count({ where: { sellerId } })).toBe(0);
  });

  it("sells the last item once when orders race for it", async () => {
    await prisma.productVariant.update({ where: { id: variantId }, data: { stock: 1 } });
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) => order(1, { phone: `09370${runId.slice(-5)}${i}` })),
    );
    const ok = results.filter((r) => r.status === "fulfilled");
    const refused = results.filter((r) => r.status === "rejected");
    expect(ok).toHaveLength(1);
    for (const r of refused) {
      expect((r as PromiseRejectedResult).reason).toSatisfy(
        (e: unknown) => e instanceof OutOfStockError || e instanceof OrderError,
      );
    }
    expect(await stockOf()).toBe(0);
    expect(await prisma.order.count({ where: { sellerId } })).toBe(1);
  });

  it("expires old unpaid link orders and gives their stock back, keeping others", async () => {
    const stale = await order(1, { purchaseLinkId: linkId, phone: `09381${runId.slice(-6)}` });
    const withReceipt = await order(1, { purchaseLinkId: linkId, phone: `09382${runId.slice(-6)}` });
    const manual = await order(1, { phone: `09383${runId.slice(-6)}` });
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    await prisma.order.updateMany({
      where: { id: { in: [stale.id, withReceipt.id, manual.id] } },
      data: { createdAt: threeDaysAgo },
    });
    await prisma.order.update({ where: { id: withReceipt.id }, data: { receiptImageUrl: "receipts/x.png" } });
    expect(await stockOf()).toBe(2);

    expect(await expireUnpaidLinkOrders(sellerId)).toBe(1);

    const statuses = await prisma.order.findMany({
      where: { id: { in: [stale.id, withReceipt.id, manual.id] } },
      select: { id: true, status: true },
    });
    const byId = Object.fromEntries(statuses.map((s) => [s.id, s.status]));
    expect(byId[stale.id]).toBe("CANCELED");
    expect(byId[withReceipt.id]).toBe("PENDING_PAYMENT");
    expect(byId[manual.id]).toBe("PENDING_PAYMENT");
    expect(await stockOf()).toBe(3);
  });
});
