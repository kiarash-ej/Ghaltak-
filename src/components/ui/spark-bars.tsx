import { cn } from "@/lib/utils";

/**
 * A small bar chart for a few days (spec §3.4 Sparkline): bars grow from the
 * baseline one after another, the last one in fire. Purely visual: the
 * numbers it shows are always written out next to it, so it's hidden from
 * screen readers. In RTL the newest bar sits at the far left, like the text.
 */
export function SparkBars({ values, className, delay = 250 }: { values: number[]; className?: string; delay?: number }) {
  const max = Math.max(...values, 1);
  return (
    <div aria-hidden className={cn("flex h-10 items-end gap-1.5", className)}>
      {values.map((v, i) => {
        const last = i === values.length - 1;
        return (
          <span
            key={i}
            className={cn(
              "flex-1 origin-bottom animate-grow-y rounded-t-[4px] rounded-b-[1px]",
              last ? "bg-fire shadow-[0_0_14px_rgb(255_90_31/0.45)]" : "bg-line-strong",
            )}
            style={{ height: `${Math.max(8, (v / max) * 100)}%`, animationDelay: `${delay + i * 60}ms` }}
          />
        );
      })}
    </div>
  );
}
