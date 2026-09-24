import type { OrderStatus, PaymentMethod } from "@/generated/prisma/enums";

// Payment rules. Pure, no database.
//
// Phase 1 has no payment gateway: the seller confirms every payment by hand.
// A gateway (Zarinpal/IDPay, Phase 2) plugs in by implementing PaymentGateway
// and, after verifying its callback, calling the same confirmPaymentInTx()
// the manual flow uses (src/server/orders/payment-store.ts).

export const PAYMENT_METHODS: readonly PaymentMethod[] = ["CARD_TO_CARD", "CASH", "OTHER"];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CARD_TO_CARD: "کارت به کارت",
  CASH: "نقدی",
  OTHER: "سایر",
};

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === "string" && (PAYMENT_METHODS as readonly string[]).includes(value);
}

/** What the customer pays: items (Order.totalPrice) plus shipping, in tomans. */
export function amountDue(order: { totalPrice: number; shippingCost: number | null }): number {
  return order.totalPrice + (order.shippingCost ?? 0);
}

/** The contract a future online gateway implements. Not used in Phase 1. */
export type PaymentGateway = {
  id: string;
  /** Starts a payment and returns the gateway page to send the customer to. */
  start(input: { orderId: string; amount: number; callbackUrl: string }): Promise<{ redirectUrl: string }>;
  /** Verifies the gateway's callback. Only a verified result may confirm an order. */
  verify(callback: URLSearchParams): Promise<
    { ok: true; orderId: string; reference: string } | { ok: false }
  >;
};

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
