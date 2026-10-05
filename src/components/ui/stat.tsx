import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CountUp } from "./count-up";
import { Explain } from "./explain";

export type StatDelta = {
  /** Already phrased, e.g. "▲ ۱۸٪ نسبت به ماه قبل". */
  text: string;
  tone: "up" | "down" | "flat";
};

/**
 * One headline number: label, value (counting up), unit, change vs the
 * previous period and an optional ؟ explanation (spec §3.4). `index` staggers
 * the rise-in when several sit in a row.
 */
export function Stat({
  label,
  value,
  decimals = 0,
  style = "number",
  unit,
  delta,
  explain,
  hero = false,
  index = 0,
  children,
  className,
}: {
  label: string;
  value: number;
  decimals?: number;
  style?: "number" | "percent";
  unit?: string;
  delta?: StatDelta;
  explain?: { title: string; body: ReactNode };
  hero?: boolean;
  index?: number;
  /** Extra content under the number, e.g. a sparkline. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex animate-rise flex-col gap-1 overflow-hidden rounded-2xl border p-4 shadow-(--gk-shadow)",
        hero ? "border-brand-2/35 bg-glow" : "border-line bg-raised",
        className,
      )}
      style={{ animationDelay: `${index * 70}ms` } as CSSProperties}
    >
      <div className="flex items-center gap-1.5 text-sm font-semibold text-muted">
        <span>{label}</span>
        {explain && <Explain title={explain.title}>{explain.body}</Explain>}
      </div>
      <div className="flex items-baseline gap-1.5">
        <CountUp value={value} decimals={decimals} style={style} className="text-2xl font-black tabular-nums" />
        {unit && <span className="text-sm font-semibold text-muted">{unit}</span>}
      </div>
      {delta && (
        <div
          className={cn(
            "text-xs font-bold",
            delta.tone === "up" && "text-success",
            delta.tone === "down" && "text-danger",
            delta.tone === "flat" && "text-muted",
          )}
        >
          {delta.text}
        </div>
      )}
      {children}
    </div>
  );
}
