import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// Cost prices (finance spec §6.1). Owner only: callers check the role.
// A cost is copied onto each order line when the order is placed
// (createOrderInTx), so changing a product's cost never rewrites past profit.

/** How many of this product's lines (in this seller's orders) have no cost yet. */
export async function countLinesWithoutCost(sellerId: string, productId: string): Promise<number> {
  return prisma.orderItem.count({ where: { productId, unitCost: null, order: { sellerId } } });
}

/**
 * «Also use it for past sales»: gives this product's lines that had no cost
 * the new cost. Only this seller's orders; lines that have a cost are never
 * touched. Returns how many lines it filled.
 */
export async function fillMissingCosts(
  tx: Prisma.TransactionClient,
  sellerId: string,
  productId: string,
  unitCost: number,
): Promise<number> {
  const r = await tx.orderItem.updateMany({
    where: { productId, unitCost: null, order: { sellerId } },
    data: { unitCost },
  });
  return r.count;
}
