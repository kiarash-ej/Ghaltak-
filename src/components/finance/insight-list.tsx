import { Lightbulb, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Insight } from "@/server/finance/insights";

// «پیشنهادهای غلتک» (spec §6.5, layout B): the best few pieces of advice,
// each with the one thing to do about it; the rest one tap away, with no
// client JavaScript. Owner only (the texts carry money).

const TONES = {
  warn: { icon: TriangleAlert, chip: "bg-warning-bg text-warning", label: "هشدار" },
  tip: { icon: Lightbulb, chip: "bg-info-bg text-brand-1", label: "پیشنهاد" },
  good: { icon: Sparkles, chip: "bg-success-bg text-success", label: "خبر خوب" },
} as const;

function InsightItem({ insight, index }: { insight: Insight; index: number }) {
  const tone = TONES[insight.tone];
  return (
    <li
      data-insight={insight.id}
      className="flex animate-rise gap-3 rounded-xl border border-line bg-raised-2/40 p-3.5"
      style={{ animationDelay: `${250 + index * 90}ms` }}
    >
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", tone.chip)}>
        <tone.icon className="size-4" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-sm font-bold leading-6">
          <span className="sr-only">{tone.label}: </span>
          {insight.title}
        </p>
        <p className="text-sm leading-7 text-ink-soft">{insight.body}</p>
        {insight.action && (
          <Link href={insight.action.href} className="mt-0.5 w-fit text-sm font-bold text-[#ff8a5b] hover:underline">
            {insight.action.label} ←
          </Link>
        )}
      </div>
    </li>
  );
}

export function InsightList({ insights, shown = 4 }: { insights: Insight[]; shown?: number }) {
  if (insights.length === 0) {
    return (
      <p className="rounded-xl border border-line bg-raised-2/40 px-4 py-3 text-sm leading-7 text-muted">
        فعلاً نکتهٔ تازه‌ای نیست. هر چه سفارش و قیمت خرید بیشتری ثبت شود، پیشنهادها دقیق‌تر می‌شوند.
      </p>
    );
  }
  const top = insights.slice(0, shown);
  const rest = insights.slice(shown);
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2.5">
        {top.map((insight, i) => (
          <InsightItem key={insight.id} insight={insight} index={i} />
        ))}
      </ul>
      {rest.length > 0 && (
        <details className="group">
          <summary className="w-fit cursor-pointer list-none rounded-lg text-sm font-bold text-ink-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">همهٔ پیشنهادها ({formatNumber(rest.length)} مورد دیگر) ↓</span>
            <span className="hidden group-open:inline">بستن ↑</span>
          </summary>
          <ul className="mt-2.5 flex flex-col gap-2.5">
            {rest.map((insight, i) => (
              <InsightItem key={insight.id} insight={insight} index={i} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
