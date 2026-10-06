import Link from "next/link";
import type { ReactNode } from "react";
import { CountUp } from "@/components/ui/count-up";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { compactToman } from "@/server/dashboard/brief-text";
import type { TodaySummary as TodaySummaryData } from "@/server/home/queries";

function Tile({
  href,
  label,
  children,
  note,
  hero = false,
  wide = false,
  index,
}: {
  href: string;
  label: string;
  children: ReactNode;
  note: string;
  hero?: boolean;
  /** Spans both columns on phones. */
  wide?: boolean;
  index: number;
}) {
  return (
    <Link
      href={href}
      style={{ animationDelay: `${index * 70}ms` }}
      className={cn(
        "group flex min-w-0 animate-rise flex-col gap-1 rounded-2xl border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
        wide && "col-span-2 sm:col-span-1",
        hero ? "border-brand-2/35 bg-glow hover:border-brand-2/60" : "border-line bg-raised hover:border-line-strong hover:bg-raised-2",
      )}
    >
      <span className="text-sm font-semibold text-muted">{label}</span>
      <span className="text-2xl font-black tabular-nums">{children}</span>
      <span className="text-xs text-muted">{note}</span>
    </Link>
  );
}

/** «سود خالص: ۲٫۳ میلیون تومان» under this month's sales. */
function netNote(net: number) {
  const c = compactToman(Math.abs(net));
  return `${net < 0 ? "زیان" : "سود خالص"}: ${formatNumber(c.value)} ${c.unit}`;
}

function Money({ amount }: { amount: number }) {
  const c = compactToman(amount);
  return (
    <>
      <CountUp value={c.value} decimals={c.decimals} /> <span className="text-sm font-semibold text-muted">{c.unit}</span>
    </>
  );
}

/**
 * «خلاصهٔ امروز» on Home (C5, restyled for the UI overhaul). The owner sees
 * money; operators see counts only (A10). What's *waiting* is in the
 * «نیاز به رسیدگی» list below, not here.
 */
export function TodaySummary({
  summary,
  showMoney = true,
  salesMonth = 0,
  netMonth = null,
  readyToShip = 0,
}: {
  summary: TodaySummaryData;
  showMoney?: boolean;
  salesMonth?: number;
  /** This month's net profit, when most sales have a cost price (finance). */
  netMonth?: number | null;
  readyToShip?: number;
}) {
  return (
    <section aria-labelledby="today-heading" className="flex flex-col gap-3">
      <h2 id="today-heading" className="text-lg font-extrabold">
        خلاصهٔ امروز
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {showMoney ? (
          <>
            <Tile hero wide index={0} href="/finance?period=today" label="فروش امروز" note={`از ${formatNumber(summary.salesToday.count)} سفارش پرداخت‌شده`}>
              <Money amount={summary.salesToday.total} />
            </Tile>
            <Tile index={1} href="/orders" label="سفارش‌های امروز" note="همهٔ سفارش‌های ثبت‌شدهٔ امروز">
              <CountUp value={summary.ordersToday} />
            </Tile>
            <Tile index={2} href="/finance" label="فروش این ماه" note={netMonth === null ? "از اول ماه تا همین حالا" : netNote(netMonth)}>
              <Money amount={salesMonth} />
            </Tile>
          </>
        ) : (
          <>
            <Tile wide index={0} href="/orders" label="سفارش‌های امروز" note="همهٔ سفارش‌های ثبت‌شدهٔ امروز">
              <CountUp value={summary.ordersToday} />
            </Tile>
            <Tile index={1} href="/orders/print?ready=1" label="آمادهٔ ارسال" note="پرداخت‌شده و هنوز ارسال‌نشده">
              <CountUp value={readyToShip} />
            </Tile>
            <Tile index={2} href="/orders?status=PENDING_PAYMENT" label="رسیدهای منتظر بررسی" note="رسید را ببینید و پرداخت را تأیید کنید">
              <CountUp value={summary.pendingReceipts} />
            </Tile>
          </>
        )}
      </div>
    </section>
  );
}
