import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma, StockMovementReason } from "@/generated/prisma/client";
import { MAX_STOCK } from "./product-form";

// The single place where ProductVariant.stock changes after creation.
// Every change is atomic (one conditional UPDATE, so concurrent orders can
// never oversell), can never go below zero or above MAX_STOCK, and writes a
// StockMovement row in the same transaction. Invariant: for every variant,
// the sum of its StockMovement.delta equals its stock.

export class VariantNotFoundError extends Error {
  constructor() {
    super("Variant not found for this seller");
    this.name = "VariantNotFoundError";
  }
}

/** The change would take stock below zero (or above MAX_STOCK). */
export class InsufficientStockError extends Error {
  constructor(readonly currentStock: number) {
    super(`Stock change not possible, current stock is ${currentStock}`);
    this.name = "InsufficientStockError";
  }
}

/** A "set to" change was based on a stock value that has changed since. */
export class StaleStockError extends Error {
  constructor(readonly currentStock: number) {
    super(`Stock changed meanwhile, current stock is ${currentStock}`);
    this.name = "StaleStockError";
  }
}

type Db = Prisma.TransactionClient;

function inTransaction<T>(tx: Db | undefined, fn: (db: Db) => Promise<T>): Promise<T> {
  return tx ? fn(tx) : prisma.$transaction(fn);
}

async function currentStockOrThrow(db: Db, sellerId: string, variantId: string) {
  const row = await db.productVariant.findFirst({
    where: { id: variantId, sellerId },
    select: { stock: true },
  });
  if (!row) throw new VariantNotFoundError();
  return row.stock;
}

export type StockChange = {
  sellerId: string;
  variantId: string;
  delta: number; // negative = reduce
  reason: StockMovementReason;
  note?: string | null;
  orderId?: string | null;
};

/**
 * Adds `delta` to the variant's stock. Pass `tx` to run inside the caller's
 * transaction (e.g. together with creating an order); otherwise it opens its own.
 * Returns the new stock.
 */
export async function changeStock(change: StockChange, tx?: Db): Promise<number> {
  const { sellerId, variantId, delta } = change;
  if (!Number.isSafeInteger(delta) || delta === 0) {
    throw new RangeError("delta must be a non-zero integer");
  }

  return inTransaction(tx, async (db) => {
    const result = await db.productVariant.updateMany({
      where: {
        id: variantId,
        sellerId,
        stock: delta < 0 ? { gte: -delta } : { lte: MAX_STOCK - delta },
      },
      data: { stock: { increment: delta } },
    });
    if (result.count === 0) {
      throw new InsufficientStockError(await currentStockOrThrow(db, sellerId, variantId));
    }

    await db.stockMovement.create({
      data: {
        variantId,
        delta,
        reason: change.reason,
        note: change.note ?? null,
        orderId: change.orderId ?? null,
      },
    });
    return currentStockOrThrow(db, sellerId, variantId);
  });
}

/**
 * Sets stock to `target` (e.g. after a physical count), but only if it still
 * equals `expectedStock`, the value the seller was looking at. Otherwise a
 * sale that happened meanwhile would be silently overwritten.
 * Returns the new stock.
 */
export async function setStock(
  input: {
    sellerId: string;
    variantId: string;
    expectedStock: number;
    target: number;
    note?: string | null;
  },
  tx?: Db,
): Promise<number> {
  const { sellerId, variantId, expectedStock, target } = input;
  if (!Number.isSafeInteger(target) || target < 0 || target > MAX_STOCK) {
    throw new RangeError("target out of range");
  }
  const delta = target - expectedStock;

  return inTransaction(tx, async (db) => {
    if (delta === 0) {
      const current = await currentStockOrThrow(db, sellerId, variantId);
      if (current !== expectedStock) throw new StaleStockError(current);
      return current;
    }

    const result = await db.productVariant.updateMany({
      where: { id: variantId, sellerId, stock: expectedStock },
      data: { stock: target },
    });
    if (result.count === 0) {
      throw new StaleStockError(await currentStockOrThrow(db, sellerId, variantId));
    }

    await db.stockMovement.create({
      data: {
        variantId,
        delta,
        reason: "MANUAL_ADJUSTMENT",
        note: input.note ?? null,
      },
    });
    return target;
  });
}

// ---------------------------------------------------------------------------
// Cross-track contract (docs/phase1/README.md), used by Track B's orders.
// ---------------------------------------------------------------------------

export type OrderStockReason = "ORDER_PLACED" | "ORDER_CANCELED" | "ORDER_RETURNED";

export type AdjustStockOptions = {
  /** Defaults to ORDER_PLACED for a negative delta and ORDER_CANCELED for a positive one. */
  reason?: OrderStockReason;
  /** Recorded on the StockMovement so the history can point at the order. */
  orderId?: string | null;
};

/**
 * Changes stock for an order. Same rules as changeStock(): atomic, never below
 * zero (throws InsufficientStockError), logged, and inside `tx` when given.
 *
 * The caller is responsible for having checked that the variant belongs to
 * the seller it acts for (Track B does: order lines come from seller-scoped
 * queries). The seller is taken from the variant itself.
 */
export async function adjustStock(
  variantId: string,
  delta: number,
  tx?: Db,
  options: AdjustStockOptions = {},
): Promise<void> {
  const reason = options.reason ?? (delta < 0 ? "ORDER_PLACED" : "ORDER_CANCELED");
  if ((reason === "ORDER_PLACED") !== delta < 0) {
    throw new RangeError(`delta ${delta} does not match reason ${reason}`);
  }

  await inTransaction(tx, async (db) => {
    const variant = await db.productVariant.findUnique({
      where: { id: variantId },
      select: { sellerId: true },
    });
    if (!variant) throw new VariantNotFoundError();

    await changeStock(
      { sellerId: variant.sellerId, variantId, delta, reason, orderId: options.orderId },
      db,
    );
  });
}
