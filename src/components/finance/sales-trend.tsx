import { APP_TIME_ZONE, formatToman } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DaySales } from "@/server/finance/breakdowns";
import { tehranDayKeys } from "@/server/reports/periods";

// The sales trend on «فروش» (spec §6.4): one bar per day, or per week when
// the period is longer than two months. Bars grow in one after another; time
// runs right to left like the text, so the newest bar is at the left. Every
// value is also in a table for screen readers.

const dayLabel = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: APP_TIME_ZONE, day: "numeric", month: "long" });
const label = (key: string) => dayLabel.format(new Date(`${key}T08:30:00Z`)); // noon in Tehran

type Bucket = { key: string; label: string; sales: number };

export function bucketSales(days: DaySales[], from: Date, to: Date): { unit: "day" | "week"; buckets: Bucket[] } {
  const byDay = new Map(days.map((d) => [d.key, d.sales]));
  const keys = tehranDayKeys(from, to);
  if (keys.length <= 62) return { unit: "day", buckets: keys.map((k) => ({ key: k, label: label(k), sales: byDay.get(k) ?? 0 })) };
  const buckets: Bucket[] = [];
  for (let i = 0; i < keys.length; i += 7) {
    const week = keys.slice(i, i + 7);
    buckets.push({ key: week[0], label: `هفتهٔ ${label(week[0])}`, sales: week.reduce((s, k) => s + (byDay.get(k) ?? 0), 0) });
  }
  return { unit: "week", buckets };
}

export function SalesTrend({ days, from, to, caption }: { days: DaySales[]; from: Date; to: Date; caption: string }) {
  const { unit, buckets } = bucketSales(days, from, to);
  if (buckets.length === 0) return null;
  const max = Math.max(...buckets.map((b) => b.sales), 1);
  const best = buckets.reduce((a, b) => (b.sales > a.sales ? b : a), buckets[0]);
  const step = Math.min(60, 900 / buckets.length);
  return (
    <figure className="flex flex-col gap-2">
      <div aria-hidden className="flex h-40 items-end gap-[3px]">
        {buckets.map((b, i) => (
          <span
            key={b.key}
            title={`${b.label}: ${formatToman(b.sales)}`}
            className={cn(
              "min-w-0 flex-1 origin-bottom animate-grow-y rounded-t-[3px]",
              b.sales === 0 ? "bg-line" : b === best ? "bg-fire" : "bg-brand-2/45",
            )}
            style={{ height: b.sales === 0 ? "3px" : `${Math.max(4, (b.sales / max) * 100)}%`, animationDelay: `${150 + i * step}ms` }}
          />
        ))}
      </div>
      <figcaption className="flex items-center justify-between gap-3 text-xs text-muted">
        <span>{buckets[0].label}</span>
        <span>{unit === "day" ? "هر ستون یک روز" : "هر ستون یک هفته"}</span>
        <span>{buckets[buckets.length - 1].label}</span>
      </figcaption>
      <table className="sr-only">
        <caption>{caption}</caption>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.key}>
              <th scope="row">{b.label}</th>
              <td>{formatToman(b.sales)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
