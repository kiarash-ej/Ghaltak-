import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { formatNumber, formatToman } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TodaySummary as TodaySummaryData } from "@/server/home/queries";

function Tile({
  href,
  label,
  value,
  note,
  attention,
}: {
  href: string;
  label: string;
  value: number;
  note: string;
  attention?: boolean;
}) {
  return (
    <Link href={href} className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400">
      <Card className={cn("h-full group-hover:bg-neutral-50", attention && "border-amber-300 bg-amber-50 group-hover:bg-amber-100")}>
        <CardContent className="flex flex-col gap-1 pt-6">
          <div className="text-sm text-neutral-500">{label}</div>
          <div className="text-2xl font-semibold">{formatNumber(value)}</div>
          <div className="text-sm text-neutral-600">{note}</div>
        </CardContent>
      </Card>
    </Link>
  );
}

/** `showMoney` false for operators (A10): no «فروش امروز» in tomans. */
export function TodaySummary({ summary, showMoney = true }: { summary: TodaySummaryData; showMoney?: boolean }) {
  return (
    <section aria-labelledby="today-heading" className="flex flex-col gap-3">
      <h2 id="today-heading" className="text-lg font-semibold">
        خلاصهٔ امروز
      </h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <Tile
          href="/orders"
          label="سفارش‌های امروز"
          value={summary.ordersToday}
          note={showMoney ? `فروش امروز: ${formatToman(summary.salesToday.total)}` : "سفارش‌های ثبت‌شدهٔ امروز"}
        />
        <Tile
          href="/orders?status=PENDING_PAYMENT"
          label="رسیدهای منتظر بررسی"
          value={summary.pendingReceipts}
          note={summary.pendingReceipts > 0 ? "رسید را ببینید و پرداخت را تأیید یا رد کنید." : "رسیدی منتظر شما نیست."}
          attention={summary.pendingReceipts > 0}
        />
        <Tile
          href="/inventory?filter=low"
          label="نیاز به تأمین"
          value={summary.needsRestock}
          note={summary.needsRestock > 0 ? "تنوع‌هایی که موجودی‌شان کم یا تمام است." : "موجودی همهٔ محصولات فعال کافی است."}
          attention={summary.needsRestock > 0}
        />
      </div>
    </section>
  );
}
