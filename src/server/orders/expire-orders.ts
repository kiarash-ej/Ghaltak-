import "server-only";
import { errorSummary } from "@/lib/error-summary";
import { prisma } from "@/lib/prisma";
import { ONLINE_PAYMENT_GRACE_MINUTES, UNSETTLED_PAYMENT_DAYS, unpaidOrderCutoff } from "./purchase-limits";
import { returnStock } from "./stock";

const BATCH = 50;

/**
 * Cancels this seller's purchase-link orders that stayed unpaid past the TTL
 * and gives their stock back. Runs lazily (before the seller's order list and
 * before new purchase-link orders) instead of on a schedule, so no cron job is
 * needed.
 *
 * Kept:
 * - manual orders, and orders with a receipt awaiting review;
 * - orders whose receipt the seller rejected less than the TTL ago: the
 *   customer gets a fresh window to send another one, however old the order;
 * - orders whose online payment started in the last ONLINE_PAYMENT_GRACE_MINUTES;
 * - orders with an online payment that reached the gateway and isn't settled
 *   yet (the customer may have paid and never come back): the seller's pages
 *   settle those first (payments/recheck.ts). After UNSETTLED_PAYMENT_DAYS
 *   they stop holding the order;
 * - orders with a verified online payment not yet applied to them (B6).
 *
 * One order that can't be canceled (its stock can't be returned, say) is
 * logged and skipped: it must never take the order list, the finance page and
 * every purchase link down with it.
 */
export async function expireUnpaidLinkOrders(sellerId: string, now = new Date()): Promise<number> {
  const cutoff = unpaidOrderCutoff(now);
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60 * 1000);
  const expirable = {
    sellerId,
    status: "PENDING_PAYMENT" as const,
    receiptImageUrl: null,
    OR: [{ receiptRejectedAt: null }, { receiptRejectedAt: { lt: cutoff } }],
    NOT: {
      paymentAttempts: {
        some: {
          OR: [
            { status: "PENDING" as const, createdAt: { gt: minutesAgo(ONLINE_PAYMENT_GRACE_MINUTES) } },
            {
              status: "PENDING" as const,
              authority: { not: null },
              createdAt: { gt: minutesAgo(UNSETTLED_PAYMENT_DAYS * 24 * 60) },
            },
            // The money arrived; only applying it is pending (online-payment.ts).
            { status: "VERIFIED" as const, failureDetail: "NOT_APPLIED" },
          ],
        },
      },
    },
  };
  const stale = await prisma.order.findMany({
    where: { ...expirable, source: "PURCHASE_LINK", createdAt: { lt: cutoff } },
    orderBy: { createdAt: "asc" },
    take: BATCH,
    select: { id: true },
  });

  let expired = 0;
  for (const order of stale) {
    try {
      await prisma.$transaction(async (tx) => {
        // Conditional, so an order paid, canceled or given a new window
        // meanwhile is left alone and stock is given back at most once.
        const { count } = await tx.order.updateMany({
          where: { ...expirable, id: order.id },
          data: { status: "CANCELED" },
        });
        if (count === 1) {
          await returnStock(order.id, "ORDER_CANCELED", tx);
          expired += 1;
        }
      });
    } catch (err) {
      console.error(`[expire orders] order ${order.id} could not be canceled`, errorSummary(err));
    }
  }
  return expired;
}
