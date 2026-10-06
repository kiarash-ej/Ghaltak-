import { formatDate, formatNumber } from "@/lib/format";
import { formatJalaliDate, jalaliDayEnd, jalaliDayStart, parseJalaliDate, type JalaliDate } from "@/server/exports/jalali";
import { reportPeriods, tehranMidnight } from "@/server/reports/periods";

// Finance periods (spec §6.3). Pure, no database. Every period is a range
// [from, to) of instants on Tehran days, with the previous period to compare
// with: the same length, aligned to its start ("the first 13 days of Mehr" vs
// "the first 13 days of Shahrivar"), so a month in progress is compared fairly.

export const PERIOD_PRESETS = ["today", "week", "month", "lastMonth", "season", "year", "custom"] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export type FinanceRange = {
  preset: PeriodPreset;
  from: Date;
  /** Exclusive: "now" for a period in progress. */
  to: Date;
  previous: { from: Date; to: Date };
  /** «این ماه (مهر)» */
  label: string;
  /** «همین بازه در شهریور»: what the deltas are measured against. */
  compareLabel: string;
  /** The custom range as typed (for the form), else undefined. */
  custom?: { from: string; to: string };
};

export type PeriodError = "from" | "to" | "range";

export const MONTH_NAMES = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
export const SEASON_NAMES = ["بهار", "تابستان", "پاییز", "زمستان"];

const DAY_MS = 24 * 60 * 60 * 1000;

/** The Tehran calendar day of an instant, in the Jalali calendar. */
export function jalaliOfInstant(instant: Date): JalaliDate {
  const [year, month, day] = formatJalaliDate(instant).split("/").map(Number);
  return { year, month, day };
}

const monthStart = (year: number, month: number) => jalaliDayStart({ year, month, day: 1 });
const prevMonth = (year: number, month: number) => (month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 });
const seasonOf = (month: number) => Math.floor((month - 1) / 3); // 0 = spring

/** The previous period: same elapsed length from its own start, never past `cap`. */
function aligned(prevFrom: Date, elapsedMs: number, cap: Date) {
  return { from: prevFrom, to: new Date(Math.min(prevFrom.getTime() + elapsedMs, cap.getTime())) };
}

type Params = { period?: string | string[]; from?: string | string[]; to?: string | string[] };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function resolvePeriod(params: Params, now: Date): FinanceRange | { error: PeriodError } {
  const asked = one(params.period);
  const preset: PeriodPreset = (PERIOD_PRESETS as readonly string[]).includes(asked) ? (asked as PeriodPreset) : "month";
  const today = jalaliOfInstant(now);

  switch (preset) {
    case "today": {
      const from = tehranMidnight(now);
      const prevFrom = new Date(from.getTime() - DAY_MS);
      return { preset, from, to: now, previous: aligned(prevFrom, now.getTime() - from.getTime(), from), label: "امروز", compareLabel: "همین ساعت دیروز" };
    }
    case "week": {
      const from = reportPeriods(now).week;
      const prevFrom = new Date(from.getTime() - 7 * DAY_MS);
      return { preset, from, to: now, previous: aligned(prevFrom, now.getTime() - from.getTime(), from), label: "این هفته", compareLabel: "همین بازه در هفتهٔ قبل" };
    }
    case "month": {
      const from = monthStart(today.year, today.month);
      const p = prevMonth(today.year, today.month);
      return {
        preset,
        from,
        to: now,
        previous: aligned(monthStart(p.year, p.month), now.getTime() - from.getTime(), from),
        label: `این ماه (${MONTH_NAMES[today.month - 1]})`,
        compareLabel: `همین بازه در ${MONTH_NAMES[p.month - 1]}`,
      };
    }
    case "lastMonth": {
      const p = prevMonth(today.year, today.month);
      const pp = prevMonth(p.year, p.month);
      const from = monthStart(p.year, p.month);
      const to = monthStart(today.year, today.month);
      return {
        preset,
        from,
        to,
        previous: { from: monthStart(pp.year, pp.month), to: from },
        label: `ماه قبل (${MONTH_NAMES[p.month - 1]})`,
        compareLabel: `کل ${MONTH_NAMES[pp.month - 1]}`,
      };
    }
    case "season": {
      const s = seasonOf(today.month);
      const from = monthStart(today.year, s * 3 + 1);
      const prev = s === 0 ? { year: today.year - 1, season: 3 } : { year: today.year, season: s - 1 };
      return {
        preset,
        from,
        to: now,
        previous: aligned(monthStart(prev.year, prev.season * 3 + 1), now.getTime() - from.getTime(), from),
        label: `این فصل (${SEASON_NAMES[s]})`,
        compareLabel: `همین بازه در ${SEASON_NAMES[prev.season]}`,
      };
    }
    case "year": {
      const from = monthStart(today.year, 1);
      return {
        preset,
        from,
        to: now,
        previous: aligned(monthStart(today.year - 1, 1), now.getTime() - from.getTime(), from),
        label: `امسال (${formatNumber(today.year).replace(/٬/g, "")})`,
        compareLabel: `همین بازه در ${formatNumber(today.year - 1).replace(/٬/g, "")}`,
      };
    }
    case "custom": {
      const fromText = one(params.from).trim();
      const toText = one(params.to).trim();
      const fromDay = parseJalaliDate(fromText);
      if (!fromDay) return { error: "from" };
      const toDay = parseJalaliDate(toText);
      if (!toDay) return { error: "to" };
      const from = jalaliDayStart(fromDay);
      const to = jalaliDayEnd(toDay);
      if (from >= to) return { error: "range" };
      const length = to.getTime() - from.getTime();
      return {
        preset,
        from,
        to,
        previous: { from: new Date(from.getTime() - length), to: from },
        label: `${formatDate(from)} تا ${formatDate(new Date(to.getTime() - DAY_MS / 2))}`,
        compareLabel: "همین تعداد روز قبل از آن",
        custom: { from: fromText, to: toText },
      };
    }
  }
}

/** The asked period, or this month with the error to show when the custom dates are wrong. */
export function resolveFinanceRange(params: Params, now: Date): { range: FinanceRange; error?: PeriodError } {
  const resolved = resolvePeriod(params, now);
  if (!("error" in resolved)) return { range: resolved };
  return { range: resolvePeriod({}, now) as FinanceRange, error: resolved.error };
}
