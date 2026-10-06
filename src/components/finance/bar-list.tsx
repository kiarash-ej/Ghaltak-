import type { ReactNode } from "react";

// Shares as horizontal bars (spec §6.4): sales by weekday, payment method,
// link or manual, expenses by category. The numbers are written out on each
// row; the bars only show proportion, so they are hidden from screen readers.

export type BarItem = { key: string; label: ReactNode; value: number; display: string; sub?: string };

export function BarList({ items, empty }: { items: BarItem[]; empty: string }) {
  const max = Math.max(...items.map((i) => i.value), 0);
  if (max <= 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item, n) => (
        <li key={item.key} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-semibold">{item.label}</span>
            <span className="whitespace-nowrap font-bold tabular-nums">
              {item.display}
              {item.sub && <span className="ms-1.5 text-xs font-normal text-muted">{item.sub}</span>}
            </span>
          </div>
          <div aria-hidden className="h-2 overflow-hidden rounded-full bg-sidebar">
            <div
              className="h-full origin-right animate-grow-x rounded-full bg-fire"
              style={{ width: `${(item.value / max) * 100}%`, animationDelay: `${150 + n * 80}ms` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
