import type { OrderStatus, PaymentMethod } from "@/generated/prisma/enums";

// Payment rules. Pure, no database.
//
// A payment is confirmed by hand by the seller, or online through the seller's
// own gateway (Phase 2, B6: src/server/payments/). Both end in the same
// confirmPaymentInTx() (src/server/orders/payment-store.ts), online only after
// the gateway's verify succeeded for the amount we recorded.

// Methods a seller can pick when confirming a payment by hand. ONLINE is not
// here on purpose: only a verified gateway callback may record it (B6).
export const PAYMENT_METHODS: readonly PaymentMethod[] = ["CARD_TO_CARD", "CASH", "OTHER"];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CARD_TO_CARD: "کارت به کارت",
  CASH: "نقدی",
  OTHER: "سایر",
  ONLINE: "پرداخت آنلاین",
};

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === "string" && (PAYMENT_METHODS as readonly string[]).includes(value);
}

/** What the customer pays: items (Order.totalPrice) plus shipping, in tomans. */
export function amountDue(order: { totalPrice: number; shippingCost: number | null }): number {
  return order.totalPrice + (order.shippingCost ?? 0);
}

/**
 * Where an order stands on payment, for badges and the customer page.
 * RECEIPT_SUBMITTED: the customer uploaded a receipt the seller hasn't reviewed.
 */
export type PaymentState = "UNPAID" | "RECEIPT_SUBMITTED" | "PAID" | "NOT_APPLICABLE";

export function paymentState(order: {
  status: OrderStatus;
  paidAt: Date | null;
  receiptImageUrl: string | null;
}): PaymentState {
  if (order.status === "PENDING_PAYMENT") {
    return order.receiptImageUrl ? "RECEIPT_SUBMITTED" : "UNPAID";
  }
  if (order.paidAt) return "PAID";
  // Canceled before paying (or old data without a payment date).
  return "NOT_APPLICABLE";
}
