import { formatNumber } from "@/lib/format";
import { jalaliDayStart } from "@/server/exports/jalali";
import { monthKey, nextMonth, parseMonthKey, previousMonth, type Month } from "./months";
import { jalaliOfInstant, MONTH_NAMES, SEASON_NAMES, type FinanceRange } from "./periods";

// Finished periods for reports and recaps (spec §6.3, §6.4, §7.2). Pure.
// Keys: month "1405-07", season "1405-s3" (بهار s1 … زمستان s4), year "1405".

export type ReportKind = "month" | "season" | "year";

export type ReportPeriod = {
  key: string;
  kind: ReportKind;
  /** «مهر ۱۴۰۵», «پاییز ۱۴۰۵», «سال ۱۴۰۵». */
  label: string;
  from: Date;
  /** Exclusive: the next period's start. */
  to: Date;
};

const year = (y: number) => formatNumber(y).replace(/٬/g, "");
const monthStart = (m: Month) => jalaliDayStart({ ...m, day: 1 });

function monthPeriod(m: Month): ReportPeriod {
  return { key: monthKey(m), kind: "month", label: `${MONTH_NAMES[m.month - 1]} ${year(m.year)}`, from: monthStart(m), to: monthStart(nextMonth(m)) };
}

/** Season 1..4 of a year. */
function seasonPeriod(y: number, s: number): ReportPeriod {
  const first = { year: y, month: (s - 1) * 3 + 1 };
  const next = s === 4 ? { year: y + 1, month: 1 } : { year: y, month: s * 3 + 1 };
  return { key: `${y}-s${s}`, kind: "season", label: `${SEASON_NAMES[s - 1]} ${year(y)}`, from: monthStart(first), to: monthStart(next) };
}

function yearPeriod(y: number): ReportPeriod {
  return { key: String(y), kind: "year", label: `سال ${year(y)}`, from: monthStart({ year: y, month: 1 }), to: monthStart({ year: y + 1, month: 1 }) };
}

export function parseReportKey(key: string): ReportPeriod | null {
  const month = parseMonthKey(key);
  if (month) return monthPeriod(month);
  const season = /^(\d{4})-s([1-4])$/.exec(key);
  if (season) return seasonPeriod(Number(season[1]), Number(season[2]));
  if (/^\d{4}$/.test(key)) return yearPeriod(Number(key));
  return null;
}

/** The period just before, of the same kind. */
export function previousPeriod(p: ReportPeriod): ReportPeriod {
  if (p.kind === "month") return monthPeriod(previousMonth(parseMonthKey(p.key)!));
  if (p.kind === "year") return yearPeriod(Number(p.key) - 1);
  const [y, s] = p.key.split("-s").map(Number);
  return s === 1 ? seasonPeriod(y - 1, 4) : seasonPeriod(y, s - 1);
}

/** As a FinanceRange, for the numbers and the advice. */
export function reportRange(p: ReportPeriod): FinanceRange {
  const before = previousPeriod(p);
  return { preset: "custom", from: p.from, to: p.to, previous: { from: before.from, to: before.to }, label: p.label, compareLabel: before.label };
}

/** Every month, season and year that ended between the store's first sale and now, newest first. */
export function finishedPeriods(firstSale: Date, now: Date): Record<ReportKind, ReportPeriod[]> {
  const first = jalaliOfInstant(firstSale);
  const today = jalaliOfInstant(now);
  const months: ReportPeriod[] = [];
  for (let m: Month = { year: first.year, month: first.month }; monthKey(m) < monthKey(today); m = nextMonth(m)) months.push(monthPeriod(m));
  const seasons: ReportPeriod[] = [];
  const seasonOf = (month: number) => Math.ceil(month / 3);
  let [y, s] = [first.year, seasonOf(first.month)];
  while (y < today.year || (y === today.year && s < seasonOf(today.month))) {
    seasons.push(seasonPeriod(y, s));
    [y, s] = s === 4 ? [y + 1, 1] : [y, s + 1];
  }
  const years: ReportPeriod[] = [];
  for (let y = first.year; y < today.year; y++) years.push(yearPeriod(y));
  return { month: months.reverse(), season: seasons.reverse(), year: years.reverse() };
}

/**
 * The recap Home shows (spec §7.2): in the first 7 days of a month, the
 * largest period that just ended (the year on 1–7 Farvardin, a season at
 * the start of its next one, else the month), and the smaller ones that
 * ended with it, for links. Null the rest of the month.
 */
export function recapFor(now: Date): { period: ReportPeriod; alsoEnded: ReportPeriod[] } | null {
  const today = jalaliOfInstant(now);
  if (today.day > 7) return null;
  const ended = previousMonth(today);
  const month = monthPeriod(ended);
  if (today.month === 1) return { period: yearPeriod(ended.year), alsoEnded: [seasonPeriod(ended.year, 4), month] };
  if ((today.month - 1) % 3 === 0) return { period: seasonPeriod(ended.year, Math.ceil(ended.month / 3)), alsoEnded: [month] };
  return { period: month, alsoEnded: [] };
}
