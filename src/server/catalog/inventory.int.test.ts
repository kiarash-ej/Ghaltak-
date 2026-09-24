import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { hasTestDatabase } from "@/test/setup";
import { prisma } from "@/lib/prisma";
import {
  InsufficientStockError,
  StaleStockError,
  VariantNotFoundError,
  changeStock,
  setStock,
} from "./inventory";
import { MAX_STOCK } from "./product-form";

// Runs against a real Postgres (TEST_DATABASE_URL). See docs/phase1/README.md.

describe.skipIf(!hasTestDatabase)("inventory (database)", () => {
  const runId = String(Date.now()).slice(-7);
  let sellerId = "";
  let otherSellerId = "";
  let variantId = "";

  async function stockOf(id: string) {
    return (await prisma.productVariant.findUniqueOrThrow({ where: { id } })).stock;
  }
  async function movementsOf(id: string) {
    return prisma.stockMovement.findMany({ where: { variantId: id }, orderBy: { createdAt: "asc" } });
  }

  beforeAll(async () => {
    const seller = await prisma.seller.create({ data: { name: "test", mobile: `0990${runId}` } });
    const other = await prisma.seller.create({ data: { name: "other", mobile: `0991${runId}` } });
    sellerId = seller.id;
    otherSellerId = other.id;
    const product = await prisma.product.create({
      data: { sellerId, name: "test product", price: 1000 },
    });
    variantId = (
      await prisma.productVariant.create({
        data: { sellerId, productId: product.id, color: "red", stock: 0 },
      })
    ).id;
  });

  beforeEach(async () => {
    await prisma.stockMovement.deleteMany({ where: { variantId } });
    await prisma.productVariant.update({ where: { id: variantId }, data: { stock: 5 } });
  });

  afterAll(async () => {
    if (!sellerId) return;
    await prisma.product.deleteMany({ where: { sellerId: { in: [sellerId, otherSellerId] } } });
    await prisma.seller.deleteMany({ where: { id: { in: [sellerId, otherSellerId] } } });
    await prisma.$disconnect();
  });

  it("adds and removes stock and logs each change", async () => {
    expect(
      await changeStock({ sellerId, variantId, delta: 3, reason: "MANUAL_ADJUSTMENT", note: "delivery" }),
    ).toBe(8);
    expect(
      await changeStock({ sellerId, variantId, delta: -2, reason: "ORDER_PLACED", orderId: "order_1" }),
    ).toBe(6);

    const log = await movementsOf(variantId);
    expect(log.map((m) => [m.delta, m.reason, m.note, m.orderId])).toEqual([
      [3, "MANUAL_ADJUSTMENT", "delivery", null],
      [-2, "ORDER_PLACED", null, "order_1"],
    ]);
  });

  it("refuses to go below zero and changes nothing", async () => {
    const err = await changeStock({ sellerId, variantId, delta: -6, reason: "ORDER_PLACED" }).catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(InsufficientStockError);
    expect((err as InsufficientStockError).currentStock).toBe(5);
    expect(await stockOf(variantId)).toBe(5);
    expect(await movementsOf(variantId)).toHaveLength(0);
  });

  it("refuses to go above the maximum", async () => {
    await expect(
      changeStock({ sellerId, variantId, delta: MAX_STOCK, reason: "MANUAL_ADJUSTMENT" }),
    ).rejects.toBeInstanceOf(InsufficientStockError);
    expect(await stockOf(variantId)).toBe(5);
  });

  it("never oversells under concurrent orders", async () => {
    const attempts = Array.from({ length: 12 }, () =>
      changeStock({ sellerId, variantId, delta: -1, reason: "ORDER_PLACED" }),
    );
    const results = await Promise.allSettled(attempts);

    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");
    expect(ok).toHaveLength(5);
    expect(failed).toHaveLength(7);
    for (const f of failed) {
      expect((f as PromiseRejectedResult).reason).toBeInstanceOf(InsufficientStockError);
    }
    expect(await stockOf(variantId)).toBe(0);
    expect(await movementsOf(variantId)).toHaveLength(5);
  });

  it("keeps the log in sync: movements sum to the change in stock", async () => {
    await changeStock({ sellerId, variantId, delta: 4, reason: "MANUAL_ADJUSTMENT" });
    await changeStock({ sellerId, variantId, delta: -7, reason: "ORDER_PLACED" });
    await setStock({ sellerId, variantId, expectedStock: 2, target: 10 });
    const sum = (await movementsOf(variantId)).reduce((a, m) => a + m.delta, 0);
    expect(5 + sum).toBe(await stockOf(variantId));
  });

  it("cannot touch another seller's variant", async () => {
    await expect(
      changeStock({ sellerId: otherSellerId, variantId, delta: -1, reason: "ORDER_PLACED" }),
    ).rejects.toBeInstanceOf(VariantNotFoundError);
    await expect(
      setStock({ sellerId: otherSellerId, variantId, expectedStock: 5, target: 0 }),
    ).rejects.toBeInstanceOf(VariantNotFoundError);
    expect(await stockOf(variantId)).toBe(5);
  });

  it("sets stock after a count and logs the difference", async () => {
    expect(await setStock({ sellerId, variantId, expectedStock: 5, target: 2, note: "count" })).toBe(2);
    const log = await movementsOf(variantId);
    expect(log.map((m) => [m.delta, m.reason, m.note])).toEqual([[-3, "MANUAL_ADJUSTMENT", "count"]]);
  });

  it("refuses a set based on a stale value", async () => {
    await changeStock({ sellerId, variantId, delta: -1, reason: "ORDER_PLACED" }); // a sale happens
    const err = await setStock({ sellerId, variantId, expectedStock: 5, target: 9 }).catch((e) => e);
    expect(err).toBeInstanceOf(StaleStockError);
    expect((err as StaleStockError).currentStock).toBe(4);
    expect(await stockOf(variantId)).toBe(4);
  });

  it("treats a set to the same value as a no-op", async () => {
    expect(await setStock({ sellerId, variantId, expectedStock: 5, target: 5 })).toBe(5);
    expect(await movementsOf(variantId)).toHaveLength(0);
  });

  it("rolls back with the caller's transaction", async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await changeStock({ sellerId, variantId, delta: -2, reason: "ORDER_PLACED" }, tx);
        throw new Error("order creation failed");
      }),
    ).rejects.toThrow("order creation failed");
    expect(await stockOf(variantId)).toBe(5);
    expect(await movementsOf(variantId)).toHaveLength(0);
  });

  it("rejects a zero or fractional delta", async () => {
    await expect(
      changeStock({ sellerId, variantId, delta: 0, reason: "MANUAL_ADJUSTMENT" }),
    ).rejects.toBeInstanceOf(RangeError);
    await expect(
      changeStock({ sellerId, variantId, delta: 1.5, reason: "MANUAL_ADJUSTMENT" }),
    ).rejects.toBeInstanceOf(RangeError);
  });
});
