import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import {
  InsufficientStockError,
  adjustStock,
  type OrderStockReason,
} from "@/server/catalog/inventory";
import { stockToReturn } from "./stock-return";

// The one place Track B touches stock. Everything goes through Track A's
// adjustStock (atomic, never below zero, logged with the order's id).

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

/** Reduces stock for every line of a new order. Must run inside the order's transaction. */
export async function takeStock(
  orderId: string,
  lines: StockLine[],
  tx: Prisma.TransactionClient,
) {
  for (const line of lines) {
    if (!line.productVariantId) continue;
    try {
      await adjustStock(line.productVariantId, -line.quantity, tx, {
        reason: "ORDER_PLACED",
        orderId,
      });
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        throw new OutOfStockError(line.productVariantId, { cause: err });
      }
      throw err;
    }
  }
}

/**
 * Gives back what this order took (cancel/return). Must run inside a transaction.
 *
 * Driven by the order's own stock movements, not its lines: an order only gets
 * back what it actually reduced, and never twice. Orders created before the
 * real adjustStock was wired in have no movements, so they return nothing
 * instead of adding stock that was never taken.
 */
export async function returnStock(
  orderId: string,
  reason: Exclude<OrderStockReason, "ORDER_PLACED">,
  tx: Prisma.TransactionClient,
) {
  const movements = await tx.stockMovement.findMany({
    where: { orderId },
    select: { variantId: true, delta: true },
  });
  for (const { variantId, quantity } of stockToReturn(movements)) {
    await adjustStock(variantId, quantity, tx, { reason, orderId });
  }
}
