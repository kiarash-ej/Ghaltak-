import { CalendarCheck, X } from "lucide-react";
import Link from "next/link";
import type { ReactElement } from "react";
import { CountUp } from "@/components/ui/count-up";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { compactToman } from "@/server/dashboard/brief-text";
import { dismissRecapAction } from "@/server/dashboard/brief-actions";
import type { ReportPeriod } from "@/server/finance/report-periods";
import type { FinanceTotals } from "@/server/finance/summary";

// «جمع‌بندی مهر ۱۴۰۵» (spec §7.2): in the first week after a month, season or
// year ends, Home's brief slot sums it up, with the way to the full report and
// its printable copy. × closes it (a cookie); the daily brief is back
// tomorrow. Owner only: the page renders it for the owner alone.

export type RecapData = {
  period: ReportPeriod;
  alsoEnded: ReportPeriod[];
  previous: ReportPeriod;
  current: FinanceTotals;
  before: FinanceTotals;
  bestProduct: string | null;
};

function Amount({ amount, className }: { amount: number; className?: string }) {
  const c = compactToman(Math.abs(amount));
  return (
    <span className={className}>
      <CountUp value={c.value} decimals={c.decimals} /> <span className="text-sm font-semibold text-muted">{c.unit}</span>
    </span>
  );
}

export function RecapCard({ recap }: { recap: RecapData }) {
  const { current: t, before } = recap;
  const change = before.sales > 0 ? Math.round(((t.sales - before.sales) / before.sales) * 100) : null;
  const knownProfit = t.coverage !== null && t.coverage >= 0.9;
  const facts = [
    { label: "فروش", value: <Amount amount={t.sales} /> },
    knownProfit && { label: t.netProfit < 0 ? "زیان خالص" : "سود خالص", value: <Amount amount={t.netProfit} className={t.netProfit < 0 ? "text-danger" : undefined} /> },
    knownProfit && t.margin !== null && { label: "حاشیهٔ سود", value: <CountUp value={t.margin} style="percent" /> },
    recap.bestProduct && { label: "پرفروش‌ترین", value: <span className="text-base">{recap.bestProduct}</span> },
  ].filter((f): f is { label: string; value: ReactElement } => Boolean(f));

  return (
    <section aria-label={`جمع‌بندی ${recap.period.label}`} className="relative animate-rise overflow-hidden rounded-2xl border border-brand-2/40 bg-glow p-4 sm:p-5">
      <span aria-hidden className="pointer-events-none absolute inset-0 animate-sheen bg-[linear-gradient(105deg,transparent_35%,rgb(255_255_255/0.07)_50%,transparent_65%)]" />
      <form action={dismissRecapAction.bind(null, recap.period.key)} className="absolute top-3 left-3">
        <button
          type="submit"
          aria-label={`بستن جمع‌بندی ${recap.period.label}`}
          className="grid size-8 place-items-center rounded-lg bg-white/5 text-muted transition-colors hover:bg-white/10 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <X className="size-4" aria-hidden />
        </button>
      </form>

      <p className="flex items-center gap-1.5 text-xs font-bold text-[#ffc9a8]">
        <CalendarCheck className="size-3.5" aria-hidden /> {recap.period.kind === "month" ? "ماه تمام شد" : recap.period.kind === "season" ? "فصل تمام شد" : "سال تمام شد"}
      </p>
      <h2 className="mt-1 text-xl font-black">جمع‌بندی {recap.period.label}</h2>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {facts.map((f, i) => (
          <div key={f.label} className="flex min-w-0 animate-rise flex-col gap-0.5" style={{ animationDelay: `${200 + i * 90}ms` }}>
            <dt className="text-xs font-semibold text-muted">{f.label}</dt>
            <dd className="truncate text-xl font-black tabular-nums">{f.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {change !== null && (
          <span className={cn("font-bold", change > 0 ? "text-success" : change < 0 ? "text-danger" : "text-muted")}>
            {change === 0 ? `فروش مثل ${recap.previous.label}` : `فروش ${change > 0 ? "▲" : "▼"} ${formatNumber(Math.abs(change))}٪ نسبت به ${recap.previous.label}`}
          </span>
        )}
        {recap.alsoEnded.map((p) => (
          <Link key={p.key} href={`/finance/reports/${p.key}`} className="text-ink-soft hover:text-ink hover:underline">
            {p.label}
          </Link>
        ))}
        <Link href={`/finance/reports/${recap.period.key}`} className="ms-auto font-bold text-[#ff8a5b] hover:underline">
          گزارش کامل و نسخهٔ چاپی ←
        </Link>
      </div>
    </section>
  );
}
