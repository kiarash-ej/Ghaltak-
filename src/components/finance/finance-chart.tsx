import type { CSSProperties } from "react";
import { APP_TIME_ZONE } from "@/lib/format";
import type { FinancePoint } from "@/server/finance/summary";

// Daily sales and net profit (spec §6.4, layout B): server-rendered SVG, the
// lines draw themselves, the area fades in, the latest point pops (spec §3.5).
// Time runs right to left like the text, so the newest day is at the left.

const W = 600;
const H = 180;
const PAD = 8;
const dayLabel = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: APP_TIME_ZONE, day: "numeric", month: "long" });
const label = (key: string) => dayLabel.format(new Date(`${key}T08:30:00Z`)); // noon in Tehran

function path(values: number[], x: (i: number) => number, y: (v: number) => number) {
  return values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
}

export function FinanceChart({ points, caption }: { points: FinancePoint[]; caption: string }) {
  if (points.length === 0) return null;
  const sales = points.map((p) => p.sales);
  const net = points.map((p) => p.net);
  const max = Math.max(...sales, ...net, 1);
  const min = Math.min(0, ...net);
  const n = points.length;
  const x = (i: number) => (n === 1 ? W / 2 : W - (i / (n - 1)) * W);
  const y = (v: number) => PAD + (1 - (v - min) / (max - min)) * (H - 2 * PAD);
  const salesPath = path(sales, x, y);
  const area = `${salesPath} L${x(n - 1).toFixed(1)},${y(min)} L${x(0).toFixed(1)},${y(min)} Z`;
  const zero = y(0);

  return (
    <figure className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={caption}
        className="h-44 w-full overflow-visible"
      >
        <defs>
          <linearGradient id="fin-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--gk-brand-2)" stopOpacity="0.32" />
            <stop offset="1" stopColor="var(--gk-brand-2)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={W} y1={PAD + f * (H - 2 * PAD)} y2={PAD + f * (H - 2 * PAD)} stroke="var(--gk-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        {min < 0 && (
          <line x1="0" x2={W} y1={zero} y2={zero} stroke="var(--gk-line-strong)" strokeDasharray="4 4" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        )}
        <path d={area} fill="url(#fin-area)" className="animate-fade" style={{ animationDelay: "900ms" }} />
        <path
          d={salesPath}
          fill="none"
          stroke="var(--gk-brand-2)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          pathLength={1}
          strokeDasharray="1"
          className="animate-draw"
          style={{ "--gk-path-length": 1, animationDelay: "300ms" } as CSSProperties}
        />
        <path
          d={path(net, x, y)}
          fill="none"
          stroke="var(--gk-success)"
          strokeWidth="2"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          pathLength={1}
          strokeDasharray="1"
          className="animate-draw"
          style={{ "--gk-path-length": 1, animationDelay: "550ms" } as CSSProperties}
        />
        <circle cx={x(n - 1)} cy={y(sales[n - 1])} r="4.5" fill="var(--gk-brand-1)" className="origin-center animate-pop [transform-box:fill-box]" style={{ animationDelay: "1500ms" }} />
      </svg>
      {/* RTL: the first item sits at the right, where the oldest day is drawn. */}
      <figcaption className="flex items-center justify-between gap-3 text-xs text-muted">
        <span>{label(points[0].key)}</span>
        <span className="flex gap-4">
          <span className="flex items-center gap-1.5">
            <i aria-hidden className="inline-block h-[3px] w-4 rounded-full bg-brand-2" /> فروش
          </span>
          <span className="flex items-center gap-1.5">
            <i aria-hidden className="inline-block h-[3px] w-4 rounded-full bg-success" /> سود خالص
          </span>
        </span>
        <span>{label(points[n - 1].key)}</span>
      </figcaption>
    </figure>
  );
}
