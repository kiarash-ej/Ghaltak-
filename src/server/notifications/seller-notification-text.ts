import type { NotificationKind } from "@/generated/prisma/enums";
import { formatDate } from "@/lib/format";

// The Persian text and the link of each in-app notification. Not server-only:
// the link is also built in client components, and the texts are unit tested.

export type OrderNotificationKind = Exclude<NotificationKind, "SUBSCRIPTION_ENDING">;

export function orderNotificationText(
  kind: OrderNotificationKind,
  o: { code: string; customerName: string | null },
): string {
  const who = o.customerName?.trim() || "مشتری";
  switch (kind) {
    case "ORDER_NEW":
      return `${who} با لینک خرید سفارش ${o.code} را ثبت کرد.`;
    case "RECEIPT_UPLOADED":
      return `${who} برای سفارش ${o.code} رسید کارت‌به‌کارت فرستاد. آن را بررسی کنید.`;
    case "ORDER_PAID_ONLINE":
      return `${who} سفارش ${o.code} را آنلاین پرداخت کرد.`;
  }
}

export function subscriptionEndingText(state: "TRIAL" | "ACTIVE", end: Date): string {
  const what = state === "TRIAL" ? "دورهٔ آزمایشی" : "اشتراک";
  return `${what} فروشگاه ${formatDate(end)} تمام می‌شود. برای ادامه، اشتراک را تمدید کنید.`;
}

/** Where a notification leads. */
export function notificationHref(n: { kind: NotificationKind; orderId: string | null }): string {
  if (n.kind === "SUBSCRIPTION_ENDING") return "/settings/billing";
  return n.orderId ? `/orders/${n.orderId}` : "/orders";
}
