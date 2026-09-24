import type { Prisma } from "@/generated/prisma/client";

/**
 * TEMPORARY STUB (owned by Track A, used by Track B until task A4 merges).
 *
 * Same signature as the real `adjustStock` in `./inventory.ts`. Track B
 * imports from this file until the real one exists, then changes the import
 * path and nothing else. Track A: delete this file when A4 is merged.
 *
 * The real version must:
 *  - throw if the resulting stock would be below zero
 *  - write a StockMovement row
 *  - run inside the caller's transaction when `tx` is passed
 */
export async function adjustStock(
  variantId: string,
  delta: number,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  void tx;
  console.warn(`[adjustStock stub] variant=${variantId} delta=${delta}`);
}
