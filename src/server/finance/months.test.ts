import { describe, expect, it } from "vitest";
import { dueMonths, gregorianKey, monthKey, monthLength, nextMonth, parseMonthKey, previousMonth, stopRepeat } from "./months";

describe("month keys", () => {
  it("round-trips and steps across the year end", () => {
    expect(monthKey({ year: 1405, month: 7 })).toBe("1405-07");
    expect(parseMonthKey("1405-07")).toEqual({ year: 1405, month: 7 });
    expect(parseMonthKey("1405-13")).toBeNull();
    expect(parseMonthKey("1405-7")).toBeNull();
    expect(nextMonth({ year: 1405, month: 12 })).toEqual({ year: 1406, month: 1 });
    expect(previousMonth({ year: 1406, month: 1 })).toEqual({ year: 1405, month: 12 });
  });

  it("knows each month's length, leap Esfand included", () => {
    expect(monthLength({ year: 1405, month: 6 })).toBe(31);
    expect(monthLength({ year: 1405, month: 7 })).toBe(30);
    expect(monthLength({ year: 1403, month: 12 })).toBe(30); // 1403 is a leap year
    expect(monthLength({ year: 1404, month: 12 })).toBe(29);
  });

  it("maps a Jalali day to the Gregorian day Expense.spentOn stores", () => {
    expect(gregorianKey({ year: 1405, month: 7, day: 1 })).toBe("2026-09-23");
    expect(gregorianKey({ year: 1405, month: 1, day: 1 })).toBe("2026-03-21");
  });
});

describe("dueMonths", () => {
  const rent = { startMonth: "1405-05", endMonth: null, dayOfMonth: 5 };

  it("every month from the start, this month only once its day has come", () => {
    expect(dueMonths(rent, { year: 1405, month: 7, day: 4 }).map((d) => d.monthKey)).toEqual(["1405-05", "1405-06"]);
    expect(dueMonths(rent, { year: 1405, month: 7, day: 5 })).toEqual([
      { monthKey: "1405-05", spentOn: "2026-07-27" },
      { monthKey: "1405-06", spentOn: "2026-08-27" },
      { monthKey: "1405-07", spentOn: "2026-09-27" },
    ]);
  });

  it("clamps the day to the month's length (the 31st is the 30th in Mehr, 29th in a common Esfand)", () => {
    const end = { startMonth: "1404-11", endMonth: null, dayOfMonth: 31 };
    expect(dueMonths(end, { year: 1405, month: 1, day: 31 }).map((d) => d.spentOn)).toEqual([
      gregorianKey({ year: 1404, month: 11, day: 30 }),
      gregorianKey({ year: 1404, month: 12, day: 29 }),
      gregorianKey({ year: 1405, month: 1, day: 31 }),
    ]);
  });

  it("stops after the last month, and before the start there is nothing", () => {
    expect(dueMonths({ ...rent, endMonth: "1405-06" }, { year: 1405, month: 9, day: 30 }).map((d) => d.monthKey)).toEqual(["1405-05", "1405-06"]);
    expect(dueMonths({ ...rent, startMonth: "1405-08" }, { year: 1405, month: 7, day: 30 })).toEqual([]);
  });

  it("crosses the year end", () => {
    expect(dueMonths({ startMonth: "1405-11", endMonth: null, dayOfMonth: 1 }, { year: 1406, month: 2, day: 1 }).map((d) => d.monthKey)).toEqual([
      "1405-11",
      "1405-12",
      "1406-01",
      "1406-02",
    ]);
  });
});

describe("stopRepeat", () => {
  const today = { year: 1405, month: 7, day: 3 };

  it("ends with this month once its row exists, else with last month", () => {
    expect(stopRepeat({ startMonth: "1405-03" }, today, { thisMonth: true, any: true })).toEqual({ endMonth: "1405-07" });
    expect(stopRepeat({ startMonth: "1405-03" }, today, { thisMonth: false, any: true })).toEqual({ endMonth: "1405-06" });
  });

  it("is deleted only if it never made a row (stopped before its first month)", () => {
    expect(stopRepeat({ startMonth: "1405-07" }, today, { thisMonth: false, any: false })).toEqual({ delete: true });
  });

  it("after «ادامه» this month, stopping before its day keeps it (and its past months)", () => {
    // Resumed on 2 Mehr: start 1405-07, day 5 not reached; months up to 1405-04 exist.
    const stop = stopRepeat({ startMonth: "1405-07" }, today, { thisMonth: false, any: true });
    expect(stop).toEqual({ endMonth: "1405-06" });
    // Ending before its start: nothing more is ever due.
    expect(dueMonths({ startMonth: "1405-07", endMonth: "1405-06", dayOfMonth: 5 }, { year: 1405, month: 9, day: 30 })).toEqual([]);
  });
});
