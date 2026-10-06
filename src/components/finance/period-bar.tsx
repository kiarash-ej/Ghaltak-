import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { FinanceRange, PeriodError, PeriodPreset } from "@/server/finance/periods";

// The period chips on top of finance (spec §6.4). Plain links and a GET form:
// the period lives in the URL, so it can be shared, bookmarked and printed.

const CHIPS: { preset: Exclude<PeriodPreset, "custom">; label: string }[] = [
  { preset: "today", label: "امروز" },
  { preset: "week", label: "این هفته" },
  { preset: "month", label: "این ماه" },
  { preset: "lastMonth", label: "ماه قبل" },
  { preset: "season", label: "این فصل" },
  { preset: "year", label: "امسال" },
];

const ERRORS: Record<PeriodError, string> = {
  from: "تاریخ «از» درست نیست. مثلاً ۱۴۰۵/۰۷/۰۱ بنویسید.",
  to: "تاریخ «تا» درست نیست. مثلاً ۱۴۰۵/۰۷/۳۰ بنویسید.",
  range: "تاریخ «از» باید پیش از تاریخ «تا» باشد.",
  long: "بازهٔ دلخواه حداکثر دو سال می‌تواند باشد.",
};

export function PeriodBar({ basePath, range, error }: { basePath: string; range: FinanceRange; error?: PeriodError }) {
  const customOpen = range.preset === "custom" || Boolean(error);
  return (
    <div className="flex flex-col gap-3">
      <nav aria-label="بازهٔ زمانی" className="flex flex-wrap items-center gap-2">
        {CHIPS.map((c) => {
          const active = range.preset === c.preset && !error;
          return (
            <Link
              key={c.preset}
              href={c.preset === "month" ? basePath : `${basePath}?period=${c.preset}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                active ? "border-transparent bg-action" : "border-line text-ink-soft hover:border-line-strong hover:text-ink",
              )}
            >
              {c.label}
            </Link>
          );
        })}
      </nav>
      <details open={customOpen} className="group">
        <summary className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-fit cursor-pointer list-none text-muted")}>
          بازهٔ دلخواه…
        </summary>
        <form method="GET" action={basePath} className="mt-2 flex flex-wrap items-end gap-2">
          <input type="hidden" name="period" value="custom" />
          <label className="flex flex-col gap-1 text-sm">
            از تاریخ
            <Input name="from" defaultValue={range.custom?.from} placeholder="۱۴۰۵/۰۷/۰۱" inputMode="numeric" dir="ltr" className="w-36 text-end" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            تا تاریخ
            <Input name="to" defaultValue={range.custom?.to} placeholder="۱۴۰۵/۰۷/۳۰" inputMode="numeric" dir="ltr" className="w-36 text-end" />
          </label>
          <Button type="submit" variant="outline">
            نمایش
          </Button>
        </form>
        {error && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {ERRORS[error]}
          </p>
        )}
      </details>
    </div>
  );
}
