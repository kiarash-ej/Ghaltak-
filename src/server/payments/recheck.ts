import "server-only";
import { prisma } from "@/lib/prisma";
import { scheduleCustomerSms } from "@/server/notifications/schedule";
import { notifyOrderEvent } from "@/server/notifications/seller-notifications";
import { retryStaleOrderPayments } from "./online-payment";

/**
 * Settles online payments that never came back from the gateway
 * (retryStaleOrderPayments) and announces the ones that turn out paid: the
 * seller's notification always, and the customer's ORDER_PAID SMS when asked
 * (not when the customer is the one looking at the page). Both are sent at
 * most once per order. Call from a request (a page or an action). Never throws.
 */
export async function recheckOrderPayments(
  scope: { sellerId: string; orderId?: string } | { orderId: string },
  opts: { tellCustomer: boolean },
): Promise<number> {
  const paid = await retryStaleOrderPayments(scope);
  for (const orderId of paid) {
    await notifyOrderEvent("ORDER_PAID_ONLINE", orderId);
    if (opts.tellCustomer) await scheduleCustomerSms("ORDER_PAID", orderId);
  }
  return paid.length;
}

/**
 * The same, from the customer's own order page (public, found by its token).
 * One small query when there is nothing to settle. The customer is looking at
 * the page, so no SMS.
 */
export async function recheckPaymentsForCustomer(publicToken: string): Promise<void> {
  try {
    const order = await prisma.order.findUnique({ where: { publicToken }, select: { id: true, status: true } });
    if (order?.status === "PENDING_PAYMENT") await recheckOrderPayments({ orderId: order.id }, { tellCustomer: false });
  } catch (err) {
    console.error("[payment recheck] failed:", (err as Error)?.name);
  }
}
