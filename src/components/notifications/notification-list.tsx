"use client";

import { CalendarClock, ChevronLeft, CreditCard, ReceiptText, ShoppingBag, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { NotificationKind } from "@/generated/prisma/enums";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { markNotificationsReadAction } from "@/server/notifications/seller-notification-actions";
import { notificationHref } from "@/server/notifications/seller-notification-text";

export type NotificationRow = {
  id: string;
  kind: NotificationKind;
  orderId: string | null;
  text: string;
  unread: boolean;
  createdAt: Date;
};

const LOOK: Record<NotificationKind, { icon: LucideIcon; tone: string }> = {
  ORDER_NEW: { icon: ShoppingBag, tone: "bg-info-bg text-info" },
  RECEIPT_UPLOADED: { icon: ReceiptText, tone: "bg-warning-bg text-warning" },
  ORDER_PAID_ONLINE: { icon: CreditCard, tone: "bg-success-bg text-success" },
  SUBSCRIPTION_ENDING: { icon: CalendarClock, tone: "bg-danger-bg text-danger" },
};

/**
 * The notifications, newest first. Opening the page marks them read, which
 * clears the badges; the ones that were new stay highlighted until the member
 * leaves the page.
 */
export function NotificationList({ items }: { items: NotificationRow[] }) {
  const unreadIds = items.filter((n) => n.unread).map((n) => n.id);
  const unread = unreadIds.length;
  // Remembers what was new when it arrived, during render (not in an effect).
  const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set(unreadIds));
  if (unreadIds.some((id) => !fresh.has(id))) setFresh(new Set([...fresh, ...unreadIds]));

  // Again whenever a refresh brings new unread rows.
  useEffect(() => {
    if (unread > 0) void markNotificationsReadAction();
  }, [unread]);

  return (
    <ul className="flex flex-col gap-2">
      {items.map((n) => {
        const { icon: Icon, tone } = LOOK[n.kind];
        const isNew = n.unread || fresh.has(n.id);
        return (
          <li key={n.id}>
            <Link
              href={notificationHref(n)}
              className={cn(
                "group flex items-center gap-3 rounded-xl border px-3.5 py-3 text-sm transition-colors hover:border-line-strong hover:bg-raised-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                isNew ? "border-line-strong bg-raised" : "border-line",
              )}
            >
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", tone)}>
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block leading-7", isNew ? "font-bold" : "text-ink-soft")}>{n.text}</span>
                <span className="block text-xs text-muted">{formatDateTime(n.createdAt)}</span>
              </span>
              {isNew && (
                <span className="shrink-0 rounded-full bg-count px-2 py-0.5 text-xs font-bold text-white">تازه</span>
              )}
              <ChevronLeft className="size-4 shrink-0 text-muted transition-transform group-hover:-translate-x-0.5" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
