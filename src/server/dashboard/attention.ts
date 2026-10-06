import "server-only";
import { cache } from "react";
import { inventorySummary } from "@/server/catalog/inventory-queries";
import { countReadyToShip } from "@/server/orders/print";
import { countPendingReceipts } from "@/server/orders/queries";

// What is waiting for the seller, for the navigation badges, the phone's bell
// and Home's «نیاز به رسیدگی». Each number reuses its owner's definition:
// receipts waiting (B3), paid and not shipped (B9), needs restock (Track A).
// Cached per request, so the layout and Home share one set of queries.

export type Attention = {
  /** Card-to-card receipts the seller hasn't reviewed. */
  receipts: number;
  /** Paid or preparing: to pack and ship. */
  readyToShip: number;
  /** Active variants at or below their low-stock threshold. */
  lowStock: number;
};

export const getAttention = cache(async (sellerId: string): Promise<Attention> => {
  const [receipts, readyToShip, inventory] = await Promise.all([
    countPendingReceipts(sellerId),
    countReadyToShip(sellerId),
    inventorySummary(sellerId),
  ]);
  return { receipts, readyToShip, lowStock: inventory.low };
});

/** The number on the Orders tab: everything order-related waiting for action. */
export function ordersWaiting(a: Attention): number {
  return a.receipts + a.readyToShip;
}
