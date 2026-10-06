import { jalaliDayStart, parseJalaliDate, type JalaliDate } from "@/server/exports/jalali";
import { tehranDateKey } from "@/server/reports/periods";

// Jalali months as keys ("1405-07"), for monthly repeating expenses (spec
// §6.1) and period reports (§6.3). Pure, no database.

export type Month = { year: number; month: number };

export const monthKey = (m: Month) => `${m.year}-${String(m.month).padStart(2, "0")}`;

export function parseMonthKey(key: string): Month | null {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return null;
  const m = { year: Number(match[1]), month: Number(match[2]) };
  return m.month >= 1 && m.month <= 12 ? m : null;
}

export const nextMonth = (m: Month): Month => (m.month === 12 ? { year: m.year + 1, month: 1 } : { year: m.year, month: m.month + 1 });
export const previousMonth = (m: Month): Month => (m.month === 1 ? { year: m.year - 1, month: 12 } : { year: m.year, month: m.month - 1 });

/** 31 days in the first six months, 30 in the next five, 29 or 30 in Esfand. */
export function monthLength(m: Month): number {
  if (m.month <= 6) return 31;
  if (m.month <= 11) return 30;
  return parseJalaliDate(`${m.year}/12/30`) ? 30 : 29;
}

/** The Gregorian calendar day ("2026-09-27") that is this Jalali day in Tehran, as Expense.spentOn stores it. */
export function gregorianKey(d: JalaliDate): string {
  return tehranDateKey(new Date(jalaliDayStart(d).getTime() + 12 * 60 * 60 * 1000));
}

export type DueMonth = { monthKey: string; spentOn: string };

/**
 * The months a repeat should have a row for by `today`: from its first month
 * to its last (or this month), each on its day (clamped to the month's
 * length, so the 31st is the 30th in Mehr), but only once that day has come.
 */
export function dueMonths(repeat: { startMonth: string; endMonth: string | null; dayOfMonth: number }, today: JalaliDate): DueMonth[] {
  const start = parseMonthKey(repeat.startMonth);
  if (!start) return [];
  const thisMonth = monthKey(today);
  const last = repeat.endMonth !== null && repeat.endMonth < thisMonth ? repeat.endMonth : thisMonth;
  const due: DueMonth[] = [];
  for (let m = start; monthKey(m) <= last; m = nextMonth(m)) {
    const day = Math.min(repeat.dayOfMonth, monthLength(m));
    if (monthKey(m) === thisMonth && day > today.day) break;
    due.push({ monthKey: monthKey(m), spentOn: gregorianKey({ ...m, day }) });
  }
  return due;
}
