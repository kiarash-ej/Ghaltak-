import { APP_TIME_ZONE, toEnglishDigits } from "@/lib/format";
import { tehranMidnight } from "@/server/reports/periods";

// Jalali dates for the orders export (Phase 2, C6). Pure, no database.
//
// The conversion uses the same Intl Persian calendar the app displays dates
// with, so a date typed here is exactly the date shown elsewhere in the app.

export type JalaliDate = { year: number; month: number; day: number };

const DAY_MS = 24 * 60 * 60 * 1000;

const persianParts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
});
const tehranTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function jalaliOf(instant: Date): JalaliDate {
  const parts = Object.fromEntries(persianParts.formatToParts(instant).map((p) => [p.type, p.value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

// Days from 1 Farvardin to the given day, ignoring leap years (fine for
// correcting an estimate).
const dayOfYear = (d: JalaliDate) => (d.month <= 6 ? (d.month - 1) * 31 : 186 + (d.month - 7) * 30) + d.day - 1;
const roughDays = (d: JalaliDate) => d.year * 365 + dayOfYear(d);

/** Noon UTC of the Gregorian day that is `d` in Tehran, or null if `d` doesn't exist (e.g. 30 Esfand of a common year). */
function noonOf(d: JalaliDate): Date | null {
  // 1 Farvardin is 20 or 21 March; estimate, then correct with Intl.
  let guess = Date.UTC(d.year + 621, 2, 21, 12) + dayOfYear(d) * DAY_MS;
  for (let i = 0; i < 4; i++) {
    const got = jalaliOf(new Date(guess));
    if (got.year === d.year && got.month === d.month && got.day === d.day) return new Date(guess);
    let diff = roughDays(d) - roughDays(got);
    // 30 Esfand of a leap year and the next 1 Farvardin count the same here.
    if (diff === 0) diff = d.year > got.year ? 1 : -1;
    guess += diff * DAY_MS;
  }
  return null;
}

/** "1405/07/01", "۱۴۰۵/۷/۱" or "1405-07-01" -> a date that exists, or null. */
export function parseJalaliDate(input: string): JalaliDate | null {
  const match = toEnglishDigits(input.trim()).match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return null;
  const d = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  if (d.year < 1300 || d.year > 1500 || d.month < 1 || d.month > 12 || d.day < 1) return null;
  if (d.day > (d.month <= 6 ? 31 : 30)) return null;
  return noonOf(d) ? d : null;
}

/** The instant the Jalali day starts: midnight in Tehran. `d` must come from parseJalaliDate. */
export function jalaliDayStart(d: JalaliDate): Date {
  const noon = noonOf(d);
  if (!noon) throw new Error("not a Jalali date");
  return tehranMidnight(noon);
}

/** The instant the Jalali day after `d` starts, for an inclusive "to" date. */
export function jalaliDayEnd(d: JalaliDate): Date {
  return tehranMidnight(new Date(jalaliDayStart(d).getTime() + DAY_MS + 12 * 60 * 60 * 1000));
}

/** Date -> "1405/07/04" (Tehran), English digits so spreadsheets can sort it. */
export function formatJalaliDate(instant: Date): string {
  const d = jalaliOf(instant);
  return `${d.year}/${String(d.month).padStart(2, "0")}/${String(d.day).padStart(2, "0")}`;
}

/** Date -> "14:30" (Tehran). */
export function formatTehranTime(instant: Date): string {
  return tehranTime.format(instant);
}
