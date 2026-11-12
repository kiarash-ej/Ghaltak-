import "server-only";
import type { MemberRole, NotificationKind } from "@/generated/prisma/enums";
import { errorSummary } from "@/lib/error-summary";
import { prisma } from "@/lib/prisma";
import { orderCode } from "@/server/orders/queries";
import { orderNotificationText, type OrderNotificationKind } from "./seller-notification-text";

// In-app notifications for the store's members (the bell). They cost nothing,
// so anything the SELLER should hear about goes here instead of an SMS.
//
// Rules, like customer SMS:
// - Call AFTER the event's transaction commits.
// - Never throws: a notification problem must not break an order or a payment.
// - One row per event: `dedupeKey` is unique, so a repeated call adds nothing.

export type NotifySellerInput = {
  sellerId: string;
  kind: NotificationKind;
  text: string;
  dedupeKey: string;
  orderId?: string | null;
  ownerOnly?: boolean;
};

/** "created", "duplicate" (this event already has one) or "failed" (logged). */
export type NotifySellerResult = "created" | "duplicate" | "failed";
export type NotifySeller = (input: NotifySellerInput) => Promise<NotifySellerResult>;

export const notifySeller: NotifySeller = async (input) => {
  try {
    const { count } = await prisma.notification.createMany({
      data: [
        {
          sellerId: input.sellerId,
          kind: input.kind,
          text: input.text,
          dedupeKey: input.dedupeKey,
          orderId: input.orderId ?? null,
          ownerOnly: input.ownerOnly ?? false,
        },
      ],
      skipDuplicates: true,
    });
    return count === 1 ? "created" : "duplicate";
  } catch (err) {
    console.error(`[notification] ${input.kind} could not be saved`, errorSummary(err));
    return "failed";
  }
};

/**
 * A notification about one order. `occurrence` tells apart events that can
 * happen more than once for an order (each uploaded receipt).
 */
export async function notifyOrderEvent(
  kind: OrderNotificationKind,
  orderId: string,
  occurrence = "",
): Promise<NotifySellerResult> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, sellerId: true, customer: { select: { name: true } } },
    });
    if (!order) return "failed";
    return await notifySeller({
      sellerId: order.sellerId,
      kind,
      orderId: order.id,
      text: orderNotificationText(kind, { code: orderCode(order.id), customerName: order.customer.name }),
      dedupeKey: [kind, order.id, occurrence].filter(Boolean).join(":"),
    });
  } catch (err) {
    console.error(`[notification] ${kind} could not be prepared`, errorSummary(err));
    return "failed";
  }
}

/** What this member may see: operators don't get the owner's notifications. */
const visibleTo = (sellerId: string, role: MemberRole) => ({
  sellerId,
  ...(role === "OWNER" ? {} : { ownerOnly: false }),
});

export function countUnreadNotifications(sellerId: string, role: MemberRole): Promise<number> {
  return prisma.notification.count({ where: { ...visibleTo(sellerId, role), readAt: null } });
}

export const NOTIFICATIONS_SHOWN = 50;

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  orderId: string | null;
  text: string;
  unread: boolean;
  createdAt: Date;
};

/** The newest notifications, unread or not. */
export async function listNotifications(sellerId: string, role: MemberRole): Promise<NotificationItem[]> {
  const rows = await prisma.notification.findMany({
    where: visibleTo(sellerId, role),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: NOTIFICATIONS_SHOWN,
    select: { id: true, kind: true, orderId: true, text: true, readAt: true, createdAt: true },
  });
  return rows.map(({ readAt, ...n }) => ({ ...n, unread: readAt === null }));
}

/** Marks everything this member can see as read; returns how many changed. */
export async function markNotificationsRead(sellerId: string, role: MemberRole, now = new Date()): Promise<number> {
  const { count } = await prisma.notification.updateMany({
    where: { ...visibleTo(sellerId, role), readAt: null },
    data: { readAt: now },
  });
  return count;
}
