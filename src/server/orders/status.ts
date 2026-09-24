import type { OrderStatus } from "@/generated/prisma/enums";

// Order status rules. Pure, no database: every status change in the app goes
// through canTransition() so the rules live in exactly one place.
//
//   PENDING_PAYMENT → PAID → PREPARING → SHIPPED → DELIVERED
//   Before shipping, an order can be CANCELED. After shipping, RETURNED.
//   CANCELED and RETURNED are final.

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAID",
  "PREPARING",
  "SHIPPED",
  "DELIVERED",
  "CANCELED",
  "RETURNED",
];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "در انتظار پرداخت",
  PAID: "پرداخت‌شده",
  PREPARING: "در حال آماده‌سازی",
  SHIPPED: "ارسال‌شده",
  DELIVERED: "تحویل‌شده",
  CANCELED: "لغوشده",
  RETURNED: "مرجوعی",
};

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING_PAYMENT: ["PAID", "CANCELED"],
  PAID: ["PREPARING", "CANCELED"],
  PREPARING: ["SHIPPED", "CANCELED"],
  SHIPPED: ["DELIVERED", "RETURNED"],
  DELIVERED: ["RETURNED"],
  CANCELED: [],
  RETURNED: [],
};

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextStatuses(from: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[from];
}

/**
 * Some moves need more than a button: PAID needs a payment method (and maybe
 * a receipt), SHIPPED needs a shipping method. Those go through their own
 * form and action, never through the generic status buttons.
 */
export function detailsRequiredFor(to: OrderStatus): "payment" | "shipping" | null {
  if (to === "PAID") return "payment";
  if (to === "SHIPPED") return "shipping";
  return null;
}

/** Canceled and returned orders give their items back to stock. */
export function restoresStock(to: OrderStatus): boolean {
  return to === "CANCELED" || to === "RETURNED";
}

/** Orders that still need work from the seller (used by lists and the report). */
export function isOpenStatus(status: OrderStatus): boolean {
  return status === "PENDING_PAYMENT" || status === "PAID" || status === "PREPARING" || status === "SHIPPED";
}
