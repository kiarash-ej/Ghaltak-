import { APP_TIME_ZONE, toEnglishDigits } from "@/lib/format";

// Report periods in Iran time. Pure, no database.
//
// "Today", "this week" and "this month" start at Tehran midnight, whatever
// time zone the server runs in. The week starts on Saturday and the month is
// the Jalali month, as Iranian sellers expect.

const DAY_MS = 24 * 60 * 60 * 1000;

const clock = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  hourCycle: "h23",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  weekday: "short",
});
const jalaliDay = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: APP_TIME_ZONE,
  day: "numeric",
});
const isoDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const WEEKDAYS = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"]; // Iranian week order

/** The instant of the most recent Tehran midnight at or before `now`. */
export function tehranMidnight(now: Date): Date {
  const parts = Object.fromEntries(clock.formatToParts(now).map((p) => [p.type, p.value]));
  const sinceMidnight =
    (Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second)) * 1000 +
    now.getUTCMilliseconds();
  return new Date(now.getTime() - sinceMidnight);
}

/** Tehran calendar date as "YYYY-MM-DD" (Gregorian), used as a stable day key. */
export function tehranDateKey(date: Date): string {
  return isoDate.format(date);
}

export type ReportPeriods = { today: Date; week: Date; month: Date };

export function reportPeriods(now: Date): ReportPeriods {
  const today = tehranMidnight(now);
  const weekday = Object.fromEntries(clock.formatToParts(now).map((p) => [p.type, p.value])).weekday;
  const daysIntoWeek = WEEKDAYS.indexOf(weekday);
  const daysIntoMonth = Number(toEnglishDigits(jalaliDay.format(now))) - 1;
  return {
    today,
    week: new Date(today.getTime() - daysIntoWeek * DAY_MS),
    month: new Date(today.getTime() - daysIntoMonth * DAY_MS),
  };
}

export type DayBucket = { key: string; start: Date };

/** The last `n` Tehran days, oldest first, ending with today. */
export function lastDays(now: Date, n: number): DayBucket[] {
  const today = tehranMidnight(now);
  return Array.from({ length: n }, (_, i) => {
    // Noon of each day avoids any edge case at a boundary when taking its key.
    const start = new Date(today.getTime() - (n - 1 - i) * DAY_MS);
    return { key: tehranDateKey(new Date(start.getTime() + DAY_MS / 2)), start };
  });
}
