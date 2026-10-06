import { Explain } from "@/components/ui/explain";
import { formatToman } from "@/lib/format";
import { cn } from "@/lib/utils";
import { explain } from "@/server/finance/glossary";
import type { FinanceTotals } from "@/server/finance/summary";

// «پول شما از کجا آمد و کجا رفت» (spec §6.4, from layout A): sales, minus the
// cost of goods, gross profit, minus expenses, net profit. Bars are shares of
// sales and grow in one after another. Owner only (money).

export function ProfitBreakdown({ totals }: { totals: FinanceTotals }) {
  const base = Math.max(totals.sales, 1);
  const rows = [
    { key: "sales", label: "فروش", value: totals.sales, bar: "bg-fire", metric: "sales" as const },
    { key: "cogs", label: "− قیمت خرید کالاها", value: -totals.cogs, bar: "bg-line-strong", metric: "cogs" as const, muted: true },
    { key: "gross", label: "سود ناخالص", value: totals.grossProfit, bar: "bg-brand-1", metric: "grossProfit" as const, rule: true },
    { key: "expenses", label: "− هزینه‌ها", value: -totals.expenses, bar: "bg-line-strong", metric: "expenses" as const, muted: true },
    {
      key: "net",
      label: totals.netProfit < 0 ? "زیان خالص" : "سود خالص",
      value: totals.netProfit,
      bar: totals.netProfit >= 0 ? "bg-success" : "bg-danger",
      metric: "netProfit" as const,
      rule: true,
      strong: true,
    },
  ];

  return (
    <dl className="flex flex-col gap-3.5">
      {rows.map((r, i) => (
        <div key={r.key} className={cn("flex flex-col gap-1.5", r.rule && "border-t border-dashed border-line-strong pt-3.5")}>
          <div className="flex items-center justify-between gap-3">
            <dt className={cn("flex items-center gap-1.5 text-sm", r.muted ? "text-muted" : "font-semibold", r.strong && "font-black")}>
              {r.label}
              <Explain title={explain(r.metric, totals).title}>{explain(r.metric, totals).body}</Explain>
            </dt>
            {/* The label carries the minus («− هزینه‌ها»); red marks what was taken away. */}
            <dd className={cn("text-sm font-bold whitespace-nowrap tabular-nums", r.value < 0 && "text-danger", r.strong && (r.value >= 0 ? "text-success" : "text-danger"))}>
              {formatToman(Math.abs(r.value))}
            </dd>
          </div>
          <div aria-hidden className="h-2.5 overflow-hidden rounded-full bg-sidebar">
            <div
              className={cn("h-full origin-right animate-grow-x rounded-full", r.bar)}
              style={{ width: `${Math.min(100, (Math.abs(r.value) / base) * 100)}%`, animationDelay: `${200 + i * 120}ms` }}
            />
          </div>
        </div>
      ))}
    </dl>
  );
}
