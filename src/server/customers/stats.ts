import type { CustomerTag, OrderStatus } from "@/generated/prisma/enums";

// Customer statistics and tag suggestion. Pure, no database.

/**
 * Orders that count as a real purchase: paid and not given back.
 * PENDING_PAYMENT (not paid yet), CANCELED and RETURNED do not count toward
 * "total spent" or the purchase count.
 */
export const PURCHASE_STATUSES: readonly OrderStatus[] = ["PAID", "PREPARING", "SHIPPED", "DELIVERED"];

export function isPurchase(status: OrderStatus): boolean {
  return PURCHASE_STATUSES.includes(status);
}

export const TAG_LABELS: Record<CustomerTag, string> = {
  NEW: "جدید",
  LOYAL: "وفادار",
  INACTIVE: "غیرفعال",
};

export const CUSTOMER_TAGS: readonly CustomerTag[] = ["NEW", "LOYAL", "INACTIVE"];

export function isCustomerTag(value: unknown): value is CustomerTag {
  return typeof value === "string" && (CUSTOMER_TAGS as readonly string[]).includes(value);
}

export type CustomerStats = {
  orderCount: number; // every order, any status
  purchaseCount: number;
  totalSpent: number; // tomans, purchases only
  averageOrder: number | null; // tomans, rounded; null without purchases
  lastPurchaseAt: Date | null;
  returnCount: number;
};

export function computeStats(
  orders: { status: OrderStatus; totalPrice: number; createdAt: Date }[],
): CustomerStats {
  let purchaseCount = 0;
  let totalSpent = 0;
  let returnCount = 0;
  let lastPurchaseAt: Date | null = null;

  for (const o of orders) {
    if (o.status === "RETURNED") returnCount++;
    if (!isPurchase(o.status)) continue;
    purchaseCount++;
    totalSpent += o.totalPrice;
    if (!lastPurchaseAt || o.createdAt > lastPurchaseAt) lastPurchaseAt = o.createdAt;
  }

  return {
    orderCount: orders.length,
    purchaseCount,
    totalSpent,
    averageOrder: purchaseCount > 0 ? Math.round(totalSpent / purchaseCount) : null,
    lastPurchaseAt,
    returnCount,
  };
}

export const LOYAL_MIN_PURCHASES = 3;
export const INACTIVE_AFTER_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

export type TagSuggestion = { tag: CustomerTag; reason: string };

/**
 * Suggests a tag from purchase history. The seller decides; nothing is
 * changed automatically.
 *  - INACTIVE: no purchase in the last 90 days (or none at all and the
 *    customer is older than 90 days)
 *  - LOYAL: at least 3 purchases, the last one within 90 days
 *  - NEW: otherwise
 */
export function suggestTag(
  input: { purchaseCount: number; lastPurchaseAt: Date | null; customerCreatedAt: Date },
  now: Date = new Date(),
): TagSuggestion {
  const since = input.lastPurchaseAt ?? input.customerCreatedAt;
  const idleDays = Math.floor((now.getTime() - since.getTime()) / DAY_MS);

  if (idleDays > INACTIVE_AFTER_DAYS) {
    return {
      tag: "INACTIVE",
      reason: input.purchaseCount === 0
        ? `بیش از ${INACTIVE_AFTER_DAYS.toLocaleString("fa-IR")} روز است که ثبت شده و خریدی نداشته.`
        : `بیش از ${INACTIVE_AFTER_DAYS.toLocaleString("fa-IR")} روز از آخرین خرید گذشته.`,
    };
  }
  if (input.purchaseCount >= LOYAL_MIN_PURCHASES) {
    return {
      tag: "LOYAL",
      reason: `${input.purchaseCount.toLocaleString("fa-IR")} خرید، آخرینش در ${INACTIVE_AFTER_DAYS.toLocaleString("fa-IR")} روز اخیر.`,
    };
  }
  return {
    tag: "NEW",
    reason: input.purchaseCount === 0
      ? "هنوز خریدی نداشته."
      : `کمتر از ${LOYAL_MIN_PURCHASES.toLocaleString("fa-IR")} خرید.`,
  };
}
