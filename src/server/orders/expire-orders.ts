import "server-only";
import { prisma } from "@/lib/prisma";
import { unpaidOrderCutoff } from "./purchase-limits";
import { returnStock } from "./stock";

const BATCH = 50;

/**
 * Cancels this seller's purchase-link orders that stayed unpaid past the TTL
 * and gives their stock back. Runs lazily (before the seller's order list and
 * before new purchase-link orders) instead of on a schedule, so no cron job is
 * needed. Manual orders and orders with a receipt awaiting review are kept.
 */
export async function expireUnpaidLinkOrders(sellerId: string, now = new Date()): Promise<number> {
  const stale = await prisma.order.findMany({
    where: {
      sellerId,
      source: "PURCHASE_LINK",
      status: "PENDING_PAYMENT",
      receiptImageUrl: null,
      createdAt: { lt: unpaidOrderCutoff(now) },
    },
    orderBy: { createdAt: "asc" },
    take: BATCH,
    select: { id: true, items: { select: { productVariantId: true, quantity: true } } },
  });

  let expired = 0;
  for (const order of stale) {
    await prisma.$transaction(async (tx) => {
      // Conditional, so an order paid or canceled meanwhile is left alone and
      // stock is given back at most once.
      const { count } = await tx.order.updateMany({
        where: { id: order.id, sellerId, status: "PENDING_PAYMENT", receiptImageUrl: null },
        data: { status: "CANCELED" },
      });
      if (count === 1) {
        await returnStock(order.items, tx);
        expired += 1;
      }
    });
  }
  return expired;
}
