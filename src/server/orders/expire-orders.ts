import "server-only";
import { prisma } from "@/lib/prisma";
import { ONLINE_PAYMENT_GRACE_MINUTES, unpaidOrderCutoff } from "./purchase-limits";
import { returnStock } from "./stock";

const BATCH = 50;

/**
 * Cancels this seller's purchase-link orders that stayed unpaid past the TTL
 * and gives their stock back. Runs lazily (before the seller's order list and
 * before new purchase-link orders) instead of on a schedule, so no cron job is
 * needed. Kept: manual orders, orders with a receipt awaiting review, and
 * orders whose online payment started in the last ONLINE_PAYMENT_GRACE_MINUTES.
 */
export async function expireUnpaidLinkOrders(sellerId: string, now = new Date()): Promise<number> {
  const paymentInProgress = {
    paymentAttempts: {
      some: {
        status: "PENDING" as const,
        createdAt: { gt: new Date(now.getTime() - ONLINE_PAYMENT_GRACE_MINUTES * 60 * 1000) },
      },
    },
  };
  const stale = await prisma.order.findMany({
    where: {
      sellerId,
      source: "PURCHASE_LINK",
      status: "PENDING_PAYMENT",
      receiptImageUrl: null,
      createdAt: { lt: unpaidOrderCutoff(now) },
      NOT: paymentInProgress,
    },
    orderBy: { createdAt: "asc" },
    take: BATCH,
    select: { id: true },
  });

  let expired = 0;
  for (const order of stale) {
    await prisma.$transaction(async (tx) => {
      // Conditional, so an order paid or canceled meanwhile is left alone and
      // stock is given back at most once.
      const { count } = await tx.order.updateMany({
        where: { id: order.id, sellerId, status: "PENDING_PAYMENT", receiptImageUrl: null, NOT: paymentInProgress },
        data: { status: "CANCELED" },
      });
      if (count === 1) {
        await returnStock(order.id, "ORDER_CANCELED", tx);
        expired += 1;
      }
    });
  }
  return expired;
}
