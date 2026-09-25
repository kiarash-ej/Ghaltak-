import { describe, expect, it } from "vitest";
import { formatJalaliDate, formatTehranTime, jalaliDayStart, parseJalaliDate } from "./jalali";

describe("Jalali dates for the orders export", () => {
  it("reads the forms a seller types, in Persian or English digits", () => {
    expect(parseJalaliDate("1405/07/01")).toEqual({ year: 1405, month: 7, day: 1 });
    expect(parseJalaliDate("۱۴۰۵/۷/۱")).toEqual({ year: 1405, month: 7, day: 1 });
    expect(parseJalaliDate(" 1405-12-29 ")).toEqual({ year: 1405, month: 12, day: 29 });
  });

  it.each(["", "1405/13/01", "1405/00/10", "1405/07/31", "1405/01/32", "1404/12/30", "abc", "05/07/01", "1405/7"])(
    "refuses %j",
    (input) => {
      expect(parseJalaliDate(input)).toBeNull();
    },
  );

  it("knows leap years: 1403 has an Esfand 30th, 1404 doesn't", () => {
    expect(parseJalaliDate("1403/12/30")).toEqual({ year: 1403, month: 12, day: 30 });
    expect(parseJalaliDate("1404/12/30")).toBeNull();
  });

  it("a day starts at Tehran midnight", () => {
    // 1 Mehr 1405 = 23 Sep 2026; Tehran midnight is 20:30 UTC the day before.
    expect(jalaliDayStart({ year: 1405, month: 7, day: 1 }).toISOString()).toBe("2026-09-22T20:30:00.000Z");
    // 1 Farvardin 1405 = 21 Mar 2026.
    expect(jalaliDayStart({ year: 1405, month: 1, day: 1 }).toISOString()).toBe("2026-03-20T20:30:00.000Z");
  });

  it("round-trips every day of ten years with the app's own Jalali calendar (Intl)", () => {
    let day = jalaliDayStart({ year: 1402, month: 1, day: 1 }); // Iran dropped daylight saving in 1402
    const end = jalaliDayStart({ year: 1412, month: 1, day: 1 });
    let count = 0;
    while (day < end) {
      const parsed = parseJalaliDate(formatJalaliDate(day));
      expect(parsed).not.toBeNull();
      expect(jalaliDayStart(parsed!).getTime()).toBe(day.getTime());
      day = new Date(day.getTime() + 24 * 60 * 60 * 1000);
      count++;
    }
    expect(count).toBe(3652); // ten years, two of them leap (1403 and 1408)
  });

  it("formats dates and times in Tehran with English digits, for spreadsheets", () => {
    const at = new Date("2026-09-23T21:00:00Z"); // 00:30 on 2 Mehr in Tehran
    expect(formatJalaliDate(at)).toBe("1405/07/02");
    expect(formatTehranTime(at)).toBe("00:30");
  });
});
