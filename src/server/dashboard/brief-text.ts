import { APP_TIME_ZONE, formatNumber } from "@/lib/format";

// Words for the daily brief and Home (spec §5, §7). Pure, no database.

/** Holds the Tehran day the daily brief was folded away (brief-actions.ts). */
export const BRIEF_COOKIE = "gk_brief";

export type Compact = { value: number; decimals: 0 | 1; unit: string };

/** 6_400_000 → 6.4 «میلیون تومان»: how a seller says an amount out loud. */
export function compactToman(amount: number): Compact {
  const scale = (divisor: number, unit: string): Compact => {
    const raw = amount / divisor;
    // One decimal below 100 (6.4), none above (125); and no ".0".
    const value = raw < 100 ? Math.floor(raw * 10) / 10 : Math.floor(raw);
    return { value, decimals: Number.isInteger(value) ? 0 : 1, unit };
  };
  if (amount >= 1_000_000_000) return scale(1_000_000_000, "میلیارد تومان");
  if (amount >= 1_000_000) return scale(1_000_000, "میلیون تومان");
  if (amount >= 1_000) return { value: Math.floor(amount / 1_000), decimals: 0, unit: "هزار تومان" };
  return { value: amount, decimals: 0, unit: "تومان" };
}

export type BriefDelta = { text: string; tone: "up" | "down" | "flat" };

/** Yesterday vs the same weekday a week earlier; null without a base to compare with. */
export function briefDelta(value: number, previous: number, weekday: string): BriefDelta | null {
  if (previous <= 0) return null;
  const change = Math.round(((value - previous) / previous) * 100);
  if (change === 0) return { text: `مثل ${weekday}ٔ قبل`, tone: "flat" };
  const arrow = change > 0 ? "▲" : "▼";
  return { text: `${arrow} ${formatNumber(Math.abs(change))}٪ نسبت به ${weekday}ٔ قبل`, tone: change > 0 ? "up" : "down" };
}

const tehranHour = new Intl.DateTimeFormat("en-US", { timeZone: APP_TIME_ZONE, hour: "numeric", hourCycle: "h23" });

/** صبح / ظهر / عصر / شب بخیر by the Tehran clock. */
export function greeting(now: Date): string {
  const h = Number(tehranHour.format(now));
  if (h >= 5 && h < 12) return "صبح بخیر";
  if (h >= 12 && h < 15) return "ظهر بخیر";
  if (h >= 15 && h < 19) return "عصر بخیر";
  return "شب بخیر";
}
