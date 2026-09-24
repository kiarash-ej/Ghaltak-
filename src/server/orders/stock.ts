import "server-only";
import type { Prisma } from "@/generated/prisma/client";
// The one place Track B touches stock. When Track A merges A4, change this
// import to "@/server/catalog/inventory" and nothing else.
import { adjustStock } from "@/server/catalog/inventory.stub";

type StockLine = { productVariantId: string | null; quantity: number };

/** Thrown when an order needs more of a variant than is in stock. */
export class OutOfStockError extends Error {
  constructor(
    public readonly variantId: string,
    options?: ErrorOptions,
  ) {
    super(`variant ${variantId} is out of stock`, options);
    this.name = "OutOfStockError";
  }
}

/** Reduces stock for every line. Must run inside the order's transaction. */
export async function takeStock(lines: StockLine[], tx: Prisma.TransactionClient) {
  for (const line of lines) {
    if (!line.productVariantId) continue;
    try {
      await adjustStock(line.productVariantId, -line.quantity, tx);
    } catch (err) {
      // The adjustStock contract: it throws when stock would go below zero.
      throw new OutOfStockError(line.productVariantId, { cause: err });
    }
  }
}

/** Gives stock back for every line (cancel/return). Must run inside a transaction. */
export async function returnStock(lines: StockLine[], tx: Prisma.TransactionClient) {
  for (const line of lines) {
    if (!line.productVariantId) continue;
    await adjustStock(line.productVariantId, line.quantity, tx);
  }
}
