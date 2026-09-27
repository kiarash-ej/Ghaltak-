import "server-only";
import type { OrderStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { deleteReceipt } from "./receipt-storage";
import { shippingStatusFor } from "./shipping";
import { STATUS_LABELS, canTransition, restoresStock } from "./status";
import { returnStock } from "./stock";

/** A status change that can't be made; the message is shown to the seller. */
export class StatusError extends Error {}

/**
 * The generic status buttons (not PAID or SHIPPED, which have their own forms).
 * `sellerId` must come from the session.
 *
 * Only succeeds if nobody changed the order in the meantime, so stock is
 * restored at most once even with two clicks or two tabs.
 *
 * An unpaid order canceled with a customer's receipt: the receipt records no
 * payment but shows a card number, so it is removed. A paid order's receipt
 * stays, as the record of a payment that may need refunding.
 */
export async function changeOrderStatus(sellerId: string, orderId: string, to: OrderStatus): Promise<void> {
  const droppedReceipt = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, sellerId },
      select: { status: true, receiptImageUrl: true },
    });
    if (!order) throw new StatusError("سفارش پیدا نشد.");
    if (!canTransition(order.status, to)) {
      throw new StatusError(`تغییر وضعیت از «${STATUS_LABELS[order.status]}» به «${STATUS_LABELS[to]}» مجاز نیست.`);
    }

    const dropReceipt = to === "CANCELED" && order.status === "PENDING_PAYMENT" && order.receiptImageUrl !== null;
    const { count } = await tx.order.updateMany({
      where: { id: orderId, sellerId, status: order.status, receiptImageUrl: order.receiptImageUrl },
      data: { status: to, shippingStatus: shippingStatusFor(to), ...(dropReceipt ? { receiptImageUrl: null } : {}) },
    });
    if (count !== 1) throw new StatusError("وضعیت سفارش همزمان تغییر کرد. صفحه را تازه کنید.");

    if (restoresStock(to)) {
      await returnStock(orderId, to === "RETURNED" ? "ORDER_RETURNED" : "ORDER_CANCELED", tx);
    }
    return dropReceipt ? order.receiptImageUrl : null;
  });
  await deleteReceipt(droppedReceipt); // after the commit; never throws
}
