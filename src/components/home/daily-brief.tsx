"use client";

import { ChartLine, ChevronDown, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { CountUp } from "@/components/ui/count-up";
import { SparkBars } from "@/components/ui/spark-bars";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BriefView } from "@/server/dashboard/brief-view";

export type { BriefView };

const TONE = { warning: "bg-warning-bg text-warning", danger: "bg-danger-bg text-danger" } as const;

/**
 * Yesterday at a glance, on the first visit of the day (spec §7.1). Money is
 * shown only when the server put it in `view.money` (owners; buildBriefView
 * leaves it out for operators, so it never reaches their browser). × folds it
 * into a one-line pill for the rest of the day (a cookie set by `dismiss`);
 * the pill opens it again. Folding animates the height, never covers anything.
 */
export function DailyBrief({
  view,
  initiallyFolded,
  dismiss,
}: {
  view: BriefView;
  initiallyFolded: boolean;
  dismiss: () => Promise<void>;
}) {
  const [open, setOpen] = useState(!initiallyFolded);
  const [, startTransition] = useTransition();
  const { money } = view;
  const pillText = money
    ? `دیروز: ${formatNumber(money.sales.value)} ${money.sales.unit} فروش · ${formatNumber(view.orders)} سفارش`
    : `دیروز: ${formatNumber(view.orders)} سفارش`;

  return (
    <section aria-label="خلاصهٔ دیروز" className="flex flex-col">
      {/* Grid-rows 0fr → 1fr animates the real height of the card. */}
      <div
        className={cn(
          // visibility flips at the end of the fold, so folded really is hidden.
          "grid transition-[grid-template-rows,opacity,visibility] duration-500 ease-(--gk-ease)",
          open ? "visible grid-rows-[1fr] opacity-100" : "invisible grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden" inert={!open}>
          <div className="relative overflow-hidden rounded-2xl border border-brand-2/40 bg-glow p-4 sm:p-5">
            <span aria-hidden className="pointer-events-none absolute inset-0 animate-sheen bg-[linear-gradient(105deg,transparent_35%,rgb(255_255_255/0.07)_50%,transparent_65%)]" />
            <button
              type="button"
              aria-label="بستن خلاصهٔ دیروز"
              onClick={() => {
                setOpen(false);
                startTransition(() => dismiss());
              }}
              className="absolute top-3 left-3 grid size-8 place-items-center rounded-lg bg-white/5 text-muted transition-colors hover:bg-white/10 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <X className="size-4" aria-hidden />
            </button>

            <p className="flex items-center gap-1.5 text-xs font-bold text-[#ffc9a8]">
              <ChartLine className="size-3.5" aria-hidden /> خلاصهٔ دیروز · {view.weekday}
            </p>
            <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <p className="text-lg leading-8 font-black sm:text-xl">
                  {money ? (
                    money.sales.value > 0 ? (
                      <>
                        دیروز{" "}
                        <span className="text-fire">
                          <CountUp value={money.sales.value} decimals={money.sales.decimals} /> {money.sales.unit}
                        </span>{" "}
                        فروختید.
                      </>
                    ) : (
                      "دیروز فروشی ثبت نشد."
                    )
                  ) : (
                    <>
                      دیروز <span className="text-fire"><CountUp value={view.orders} /> سفارش</span> ثبت شد.
                    </>
                  )}
                </p>
                <p className="mt-1 text-sm text-ink-soft">
                  {money &&
                    (money.sales.value === 0 ? (
                      money.weekTotal.value > 0 ? (
                        <>در ۷ روز گذشته {formatNumber(money.weekTotal.value)} {money.weekTotal.unit} فروختید.</>
                      ) : (
                        "این هفته هنوز فروشی ثبت نشده؛ لینک خرید را در دایرکت‌ها بفرستید."
                      )
                    ) : (
                      <>{formatNumber(view.orders)} سفارش</>
                    ))}
                  {money?.delta && (
                    <>
                      {" · "}
                      <span className={cn("font-bold", money.delta.tone === "up" ? "text-success" : money.delta.tone === "down" ? "text-danger" : "text-muted")}>
                        {money.delta.text}
                      </span>
                    </>
                  )}
                </p>
              </div>
              {money && <SparkBars values={money.week} className="w-full shrink-0 sm:w-48" />}
            </div>

            {(view.todos.length > 0 || money) && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {view.todos.map((t, i) => (
                  <span
                    key={t.text}
                    className={cn("animate-rise rounded-full px-3 py-1 text-xs font-bold", TONE[t.tone])}
                    style={{ animationDelay: `${700 + i * 100}ms` }}
                  >
                    {t.text}
                  </span>
                ))}
                {money && (
                  <Link href="/finance" className="ms-auto text-sm font-bold text-[#ff8a5b] hover:underline">
                    گزارش کامل ←
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity,visibility] duration-400 ease-(--gk-ease)",
          open ? "invisible grid-rows-[0fr] opacity-0" : "visible grid-rows-[1fr] opacity-100 delay-200",
        )}
      >
        <div className="min-h-0 overflow-hidden" inert={open}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            className="flex w-full items-center justify-between gap-3 rounded-full border border-brand-2/30 bg-[linear-gradient(90deg,rgb(255_90_31/0.16),rgb(194_24_91/0.12))] px-4 py-2 text-sm font-semibold transition-colors hover:border-brand-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <span className="flex min-w-0 items-center gap-2 truncate">
              <ChartLine className="size-4 shrink-0 text-brand-2" aria-hidden />
              {pillText}
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden />
          </button>
        </div>
      </div>
    </section>
  );
}
