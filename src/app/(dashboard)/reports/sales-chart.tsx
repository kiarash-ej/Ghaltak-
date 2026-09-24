"use client";

import { useEffect, useRef, useState } from "react";
import { formatNumber, formatToman } from "@/lib/format";

// Daily sales, one series: plain SVG, no chart library, nothing loaded at runtime.
// Hover (or keyboard focus) on a day shows its tooltip; the table below the
// chart has every value for screen readers and exact reading.

export type ChartDay = { key: string; label: string; total: number; count: number };

const H = 220;
const M = { top: 12, right: 8, bottom: 28, left: 64 };
const PLOT_H = H - M.top - M.bottom;
const BAR = "#2a78d6"; // single sequential hue (blue)
const BAR_ACTIVE = "#1c5aa6";
const GRID = "#e7e6e2";

const compact = new Intl.NumberFormat("fa-IR", { notation: "compact", maximumFractionDigits: 1 });

/** Smallest 1/2/5 × 10^k at or above `max`, so axis ticks are clean numbers. */
function niceMax(max: number): number {
  if (max <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const step of [1, 2, 5, 10]) if (step * pow >= max) return step * pow;
  return 10 * pow;
}

/** Column with a 4px rounded top and a square base on the baseline. */
function barPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  const base = y + h;
  return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${base}Z`;
}

export function SalesChart({ days }: { days: ChartDay[] }) {
  const [active, setActive] = useState<number | null>(null);
  // Drawn at the container's real pixel width, so text stays 11px on phones
  // instead of shrinking with a scaled viewBox.
  const [W, setW] = useState(640);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const PLOT_W = W - M.left - M.right;
  const top = niceMax(Math.max(...days.map((d) => d.total)));
  const band = PLOT_W / days.length;
  const barW = Math.min(24, band * 0.6);
  const yOf = (v: number) => M.top + PLOT_H - (v / top) * PLOT_H;
  const ticks = [0, top / 2, top];
  const labelled = new Set([0, Math.floor(days.length / 2), days.length - 1]);
  const hasSales = days.some((d) => d.total > 0);
  const current = active === null ? null : days[active];

  return (
    <div className="flex flex-col gap-3">
      <div ref={box} className="relative" dir="ltr">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          className="block max-w-full"
          role="img"
          aria-label={`فروش روزانهٔ ${formatNumber(days.length)} روز گذشته`}
          onMouseLeave={() => setActive(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={W - M.right} y1={yOf(t)} y2={yOf(t)} stroke={GRID} strokeWidth={1} />
              <text
                x={M.left - 8}
                y={yOf(t)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-neutral-500 text-[11px]"
              >
                {compact.format(t)}
              </text>
            </g>
          ))}

          {days.map((d, i) => {
            const x = M.left + i * band + (band - barW) / 2;
            const h = (d.total / top) * PLOT_H;
            return (
              <g key={d.key}>
                {d.total > 0 && (
                  <path d={barPath(x, M.top + PLOT_H - h, barW, h)} fill={active === i ? BAR_ACTIVE : BAR} />
                )}
                {labelled.has(i) && (
                  <text
                    // First and last labels hug the plot edges so they never clip.
                    x={i === 0 ? M.left : i === days.length - 1 ? W - M.right : M.left + i * band + band / 2}
                    y={H - 8}
                    textAnchor={i === 0 ? "start" : i === days.length - 1 ? "end" : "middle"}
                    className="fill-neutral-500 text-[11px]"
                  >
                    {d.label}
                  </text>
                )}
                {/* Hit target: the whole day column, larger than the bar. */}
                <rect
                  x={M.left + i * band}
                  y={M.top}
                  width={band}
                  height={PLOT_H}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${d.label}: ${formatToman(d.total)}، ${formatNumber(d.count)} سفارش`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="outline-none focus-visible:stroke-neutral-400"
                />
              </g>
            );
          })}
        </svg>

        {current && active !== null && (
          <div
            role="status"
            dir="rtl"
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow-sm"
            style={{
              left: `${Math.min(88, Math.max(12, ((M.left + (active + 0.5) * band) / W) * 100))}%`,
            }}
          >
            <div className="font-medium text-neutral-900">{current.label}</div>
            <div className="text-neutral-700">{formatToman(current.total)}</div>
            <div className="text-neutral-500">{formatNumber(current.count)} سفارش</div>
          </div>
        )}

        {!hasSales && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-neutral-500" dir="rtl">
            در این بازه فروشی ثبت نشده است.
          </p>
        )}
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-neutral-600">نمایش جدول روزانه</summary>
        <div className="mt-2 max-h-64 overflow-y-auto">
          <table className="w-full">
            <thead className="text-neutral-500">
              <tr>
                <th className="py-1 text-start font-medium">روز</th>
                <th className="py-1 text-start font-medium">فروش</th>
                <th className="py-1 text-start font-medium">سفارش</th>
              </tr>
            </thead>
            <tbody>
              {[...days].reverse().map((d) => (
                <tr key={d.key} className="border-t border-neutral-100">
                  <td className="py-1">{d.label}</td>
                  <td className="py-1">{formatToman(d.total)}</td>
                  <td className="py-1">{formatNumber(d.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
