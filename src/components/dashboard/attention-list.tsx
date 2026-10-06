import { ChevronLeft, PackageOpen, Printer, ReceiptText } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export type AttentionCounts = { receipts: number; readyToShip: number; lowStock: number };

type Row = { key: string; icon: typeof ReceiptText; text: string; action: string; href: string; tone: "warning" | "danger" | "info" };

/** «نیاز به رسیدگی»: each waiting thing with the one action that clears it (spec §5). */
export function attentionRows(a: AttentionCounts): Row[] {
  const rows: Row[] = [];
  if (a.receipts > 0) {
    rows.push({
      key: "receipts",
      icon: ReceiptText,
      text: `${formatNumber(a.receipts)} رسید کارت‌به‌کارت منتظر تأیید`,
      action: "بررسی رسیدها",
      href: "/orders?status=PENDING_PAYMENT",
      tone: "warning",
    });
  }
  if (a.readyToShip > 0) {
    rows.push({
      key: "ship",
      icon: Printer,
      text: `${formatNumber(a.readyToShip)} سفارش آمادهٔ ارسال`,
      action: "چاپ برگهٔ ارسال",
      href: "/orders/print?ready=1",
      tone: "danger",
    });
  }
  if (a.lowStock > 0) {
    rows.push({
      key: "stock",
      icon: PackageOpen,
      text: `${formatNumber(a.lowStock)} کالا رو به اتمام`,
      action: "افزایش موجودی",
      href: "/inventory?filter=low",
      tone: "info",
    });
  }
  return rows;
}

const TONES = {
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  info: "bg-info-bg text-info",
} as const;

/**
 * The rows as links. `wrap` lets a sheet close itself when one is used.
 * Nothing waiting: a calm line instead of an empty box.
 */
export function AttentionList({
  counts,
  wrap = (node) => node,
}: {
  counts: AttentionCounts;
  wrap?: (node: ReactNode) => ReactNode;
}) {
  const rows = attentionRows(counts);
  if (rows.length === 0) {
    return <p className="rounded-xl border border-line bg-raised px-4 py-3 text-sm text-muted">چیزی منتظر شما نیست. 🎉</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r, i) => (
        <li key={r.key} className="animate-rise" style={{ animationDelay: `${i * 60}ms` }}>
          {wrap(
            <Link
              href={r.href}
              className="group flex items-center gap-3 rounded-xl border border-line bg-raised px-3.5 py-3 text-sm transition-colors hover:border-line-strong hover:bg-raised-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", TONES[r.tone])}>
                <r.icon className="size-4" aria-hidden />
              </span>
              <span className="flex-1 font-semibold">{r.text}</span>
              <span className={cn("hidden shrink-0 rounded-full px-2.5 py-1 text-xs font-bold sm:inline", TONES[r.tone])}>{r.action}</span>
              <ChevronLeft className="size-4 shrink-0 text-muted transition-transform group-hover:-translate-x-0.5" aria-hidden />
            </Link>,
          )}
        </li>
      ))}
    </ul>
  );
}
