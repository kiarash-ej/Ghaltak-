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

/**
 * The single way an order becomes PAID: manual confirmation now, a verified
 * gateway callback later. Moves PENDING_PAYMENT → PAID only if nobody changed
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

  const { count } = await tx.order.updateMany({
    where: { id: input.orderId, sellerId: input.sellerId, status: order.status },
    data: {
      status: "PAID",
      paymentMethod: input.method,
      paidAt: input.paidAt,
      ...(input.receiptKey !== undefined ? { receiptImageUrl: input.receiptKey } : {}),
    },
  });
  if (count !== 1) throw new PaymentError("وضعیت سفارش همزمان تغییر کرد. صفحه را تازه کنید.");

  const replaced = input.receiptKey !== undefined && order.receiptImageUrl !== input.receiptKey;
  return { previousReceiptKey: replaced ? order.receiptImageUrl : null };
}
