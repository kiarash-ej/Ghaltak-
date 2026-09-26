// Abuse limits for the PUBLIC purchase link. Pure, no database.
//
// The per-IP limiter (rate-limit.ts) is only the first line: many Iranian
// mobile users share one IP, and IPs can be rotated. These limits don't
// depend on the IP at all.

/**
 * Most of one item a customer can order through a purchase link. Much lower
 * than the seller's manual form (MAX_QUANTITY): unpaid link orders hold stock
 * for up to 48 hours, so a high cap would let one visitor hold it all (#18).
 * Kept here, not in buy-form.ts, because the buy page's client form reads it:
 * importing buy-form.ts there would ship zod to the customer's phone (#53).
 */
export const MAX_BUY_QUANTITY = 10;
/** Unpaid orders one phone number may have open on one link at a time. */
export const MAX_OPEN_ORDERS_PER_PHONE = 3;
/** New orders one link accepts per hour, whoever places them. */
export const MAX_LINK_ORDERS_PER_HOUR = 50;
/**
 * Unpaid purchase-link orders are canceled (and their stock given back) after
 * this long, so nobody can hold a seller's stock with orders they never pay.
 * Orders with a receipt waiting for review are never expired automatically.
 */
export const UNPAID_ORDER_TTL_HOURS = 48;
/**
 * An order whose online payment was started this recently is not expired: the
 * customer may be on the gateway's page right now (Phase 2, B6).
 */
export const ONLINE_PAYMENT_GRACE_MINUTES = 30;

export function purchaseQuotaProblem(counts: {
  openOrdersForPhone: number;
  linkOrdersLastHour: number;
}): string | null {
  if (counts.openOrdersForPhone >= MAX_OPEN_ORDERS_PER_PHONE) {
    return "با این شماره چند سفارش پرداخت‌نشده دارید. ابتدا آن‌ها را پرداخت کنید یا با فروشنده تماس بگیرید.";
  }
  if (counts.linkOrdersLastHour >= MAX_LINK_ORDERS_PER_HOUR) {
    return "این لینک در حال حاضر سفارش زیادی دریافت کرده است. کمی بعد دوباره تلاش کنید.";
  }
  return null;
}

/** Unpaid orders created before this moment are expired. */
export function unpaidOrderCutoff(now: Date): Date {
  return new Date(now.getTime() - UNPAID_ORDER_TTL_HOURS * 60 * 60 * 1000);
}
