import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hasTestDatabase } from "@/test/setup";
import { inventorySummary, listInventory } from "@/server/catalog/inventory-queries";
import { getSalesReport } from "@/server/reports/queries";

// Issue #19: "needs restock" on the inventory page and "low stock" in the
// sales report are the same rule (active products only), so the report's
// number always matches the tab it links to.
// Runs against a real Postgres (TEST_DATABASE_URL). See docs/phase1/README.md.

describe.skipIf(!hasTestDatabase)("needs restock: inventory tab vs sales report (database)", () => {
  const runId = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  let sellerId = "";

  beforeAll(async () => {
    sellerId = (await prisma.seller.create({ data: { name: "t", mobile: `0995${runId}` } })).id;
    const product = (isActive: boolean, name: string, stocks: number[]) =>
      prisma.product.create({
        data: {
          sellerId,
          name,
          price: 1000,
          isActive,
          lowStockThreshold: 3,
          variants: { create: stocks.map((stock, i) => ({ sellerId, color: `c${i}`, stock })) },
        },
      });
    await product(true, "active", [1, 10, 0]); // low, ok, out
    await product(false, "inactive", [1, 0]); // low but turned off, out but turned off
  });

  afterAll(async () => {
    if (!sellerId) return;
    await prisma.product.deleteMany({ where: { sellerId } });
    await prisma.seller.deleteMany({ where: { id: sellerId } });
    await prisma.$disconnect();
  });

  it("counts only active products as needing restock", async () => {
    // "out" and "all" are unchanged: they still include turned-off products.
    expect(await inventorySummary(sellerId)).toEqual({ total: 5, low: 2, out: 2 });
  });

  it("lists only active products in the needs-restock tab", async () => {
    const low = await listInventory(sellerId, { filter: "low" });
    expect(low.total).toBe(2);
    expect(low.items.every((r) => r.isActive)).toBe(true);
    expect(low.items.map((r) => r.stock).sort()).toEqual([0, 1]);

    const all = await listInventory(sellerId, { filter: "all" });
    expect(all.items.filter((r) => !r.isActive)).toHaveLength(2);
  });

  it("gives the same number as the sales report's low-stock count", async () => {
    const [summary, report] = await Promise.all([inventorySummary(sellerId), getSalesReport(sellerId)]);
    expect(report.lowStock.total).toBe(summary.low);
  });
});
