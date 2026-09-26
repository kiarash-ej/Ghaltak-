import "server-only";
import type { PaymentMethod, Prisma } from "@/generated/prisma/client";
import { canTransition } from "./status";

/** A payment that can't be recorded; the message is shown to the seller. */
export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentError";
  }
}

const RECEIPT_CHANGED = "مشتری رسید تازه‌ای فرستاده است. صفحه را تازه کنید و رسید جدید را ببینید.";

/**
 * The single way an order becomes PAID: manual confirmation by the seller, or
 * a verified gateway payment (B6). Moves PENDING_PAYMENT → PAID only if nobody changed
 * the order in the meantime. Must run inside a transaction.
 */
export async function confirmPaymentInTx(
  tx: Prisma.TransactionClient,
  input: {
    sellerId: string;
    orderId: string;
    method: PaymentMethod;
    paidAt: Date;
    /** Replaces the order's receipt when set; keeps the existing one when undefined. */
    receiptKey?: string;
    /**
     * Manual confirmation: the receipt the seller was looking at (null: none).
     * If the customer sent a new receipt meanwhile, nothing is recorded, so
     * an order is never marked paid on a receipt the seller hasn't seen.
     * Undefined (a verified gateway payment) skips the check.
     */
    expectedReceiptKey?: string | null;
  },
): Promise<{ previousReceiptKey: string | null }> {
  const order = await tx.order.findFirst({
    where: { id: input.orderId, sellerId: input.sellerId },
    select: { status: true, receiptImageUrl: true },
  });
  if (!order) throw new PaymentError("سفارش پیدا نشد.");
  if (!canTransition(order.status, "PAID")) {
    throw new PaymentError("فقط سفارش «در انتظار پرداخت» را می‌توان پرداخت‌شده کرد.");
  }

  if (input.expectedReceiptKey !== undefined && order.receiptImageUrl !== input.expectedReceiptKey) {
    throw new PaymentError(RECEIPT_CHANGED);
  }

  const { count } = await tx.order.updateMany({
    where: {
      id: input.orderId,
      sellerId: input.sellerId,
      status: order.status,
      ...(input.expectedReceiptKey !== undefined ? { receiptImageUrl: input.expectedReceiptKey } : {}),
    },
    data: {
      status: "PAID",
      paymentMethod: input.method,
      paidAt: input.paidAt,
      ...(input.receiptKey !== undefined ? { receiptImageUrl: input.receiptKey } : {}),
    },
  });
  if (count !== 1) {
    // Either the status or (manual confirmation) the receipt changed meanwhile.
    const now = await tx.order.findFirst({
      where: { id: input.orderId, sellerId: input.sellerId },
      select: { status: true },
    });
    throw new PaymentError(
      now?.status === order.status ? RECEIPT_CHANGED : "وضعیت سفارش همزمان تغییر کرد. صفحه را تازه کنید.",
    );
  }

  const replaced = input.receiptKey !== undefined && order.receiptImageUrl !== input.receiptKey;
  return { previousReceiptKey: replaced ? order.receiptImageUrl : null };
}
