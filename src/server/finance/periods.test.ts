import { describe, expect, it } from "vitest";
import { jalaliOfInstant, resolvePeriod } from "./periods";

// Tehran is UTC+3:30. "Now" is Tuesday 14 Mehr 1405, 10:00 Tehran.
const NOW = new Date("2026-10-06T06:30:00Z");
const iso = (d: Date) => d.toISOString();

describe("jalaliOfInstant", () => {
  it("reads the Tehran calendar day", () => {
    expect(jalaliOfInstant(NOW)).toEqual({ year: 1405, month: 7, day: 14 });
    // 00:15 Tehran on 1 Mehr is still 22 September UTC.
    expect(jalaliOfInstant(new Date("2026-09-22T20:45:00Z"))).toEqual({ year: 1405, month: 7, day: 1 });
  });
});

describe("resolvePeriod", () => {
  it("this month: from 1 Mehr to now, compared with the same 13.4 days of Shahrivar", () => {
    const p = resolvePeriod({ period: "month" }, NOW);
    if ("error" in p) throw new Error(p.error);
    expect(p.preset).toBe("month");
    expect(iso(p.from)).toBe("2026-09-22T20:30:00.000Z"); // 1 Mehr 00:00 Tehran
    expect(iso(p.to)).toBe(iso(NOW));
    expect(iso(p.previous.from)).toBe("2026-08-22T20:30:00.000Z"); // 1 Shahrivar
    expect(p.previous.to.getTime() - p.previous.from.getTime()).toBe(p.to.getTime() - p.from.getTime());
    expect(p.label).toBe("این ماه (مهر)");
    expect(p.compareLabel).toBe("همین بازه در شهریور");
  });

  it("is this month when nothing (or nonsense) is asked for", () => {
    expect(resolvePeriod({}, NOW)).toMatchObject({ preset: "month" });
    expect(resolvePeriod({ period: "decade" }, NOW)).toMatchObject({ preset: "month" });
  });

  it("today and this week (from Saturday) compare with the same elapsed time before", () => {
    const today = resolvePeriod({ period: "today" }, NOW);
    if ("error" in today) throw new Error();
    expect(iso(today.from)).toBe("2026-10-05T20:30:00.000Z");
    expect(iso(today.previous.from)).toBe("2026-10-04T20:30:00.000Z");
    expect(iso(today.previous.to)).toBe("2026-10-05T06:30:00.000Z"); // yesterday 10:00

    const week = resolvePeriod({ period: "week" }, NOW);
    if ("error" in week) throw new Error();
    expect(iso(week.from)).toBe("2026-10-02T20:30:00.000Z"); // Saturday 11 Mehr
    expect(iso(week.previous.from)).toBe("2026-09-25T20:30:00.000Z");
  });

  it("last month is all of Shahrivar, compared with all of Mordad", () => {
    const p = resolvePeriod({ period: "lastMonth" }, NOW);
    if ("error" in p) throw new Error();
    expect(iso(p.from)).toBe("2026-08-22T20:30:00.000Z"); // 1 Shahrivar
    expect(iso(p.to)).toBe("2026-09-22T20:30:00.000Z"); // 1 Mehr
    expect(iso(p.previous.from)).toBe("2026-07-22T20:30:00.000Z"); // 1 Mordad
    expect(iso(p.previous.to)).toBe("2026-08-22T20:30:00.000Z");
    expect(p.label).toBe("ماه قبل (شهریور)");
  });

  it("this season is autumn from 1 Mehr; this year is from 1 Farvardin", () => {
    const season = resolvePeriod({ period: "season" }, NOW);
    if ("error" in season) throw new Error();
    expect(iso(season.from)).toBe("2026-09-22T20:30:00.000Z");
    expect(season.label).toBe("این فصل (پاییز)");
    expect(iso(season.previous.from)).toBe("2026-06-21T20:30:00.000Z"); // 1 Tir, summer

    const year = resolvePeriod({ period: "year" }, NOW);
    if ("error" in year) throw new Error();
    expect(iso(year.from)).toBe("2026-03-20T20:30:00.000Z"); // 1 Farvardin 1405
    expect(iso(year.previous.from)).toBe("2025-03-20T20:30:00.000Z"); // 1 Farvardin 1404
    expect(year.label).toBe("امسال (۱۴۰۵)");
  });

  it("a custom range covers whole Tehran days, compared with the same number of days just before", () => {
    const p = resolvePeriod({ period: "custom", from: "۱۴۰۵/۰۷/۰۱", to: "1405/07/10" }, NOW);
    if ("error" in p) throw new Error(p.error);
    expect(iso(p.from)).toBe("2026-09-22T20:30:00.000Z");
    expect(iso(p.to)).toBe("2026-10-02T20:30:00.000Z"); // the start of 11 Mehr: 10 Mehr is included
    expect(iso(p.previous.from)).toBe("2026-09-12T20:30:00.000Z"); // 10 days earlier: 22 Shahrivar
    expect(iso(p.previous.to)).toBe(iso(p.from));
    expect(p.label).toBe("۱ مهر ۱۴۰۵ تا ۱۰ مهر ۱۴۰۵");
  });

  it("explains a bad custom range instead of guessing", () => {
    expect(resolvePeriod({ period: "custom", from: "1405/07/40", to: "1405/07/10" }, NOW)).toEqual({ error: "from" });
    expect(resolvePeriod({ period: "custom", from: "1405/07/10", to: "" }, NOW)).toEqual({ error: "to" });
    expect(resolvePeriod({ period: "custom", from: "1405/07/10", to: "1405/07/01" }, NOW)).toEqual({ error: "range" });
  });

  it("handles the end of the year: last month in Farvardin is Esfand of the year before", () => {
    const now = new Date("2026-03-30T08:30:00Z"); // 10 Farvardin 1405
    const p = resolvePeriod({ period: "lastMonth" }, now);
    if ("error" in p) throw new Error();
    expect(iso(p.from)).toBe("2026-02-19T20:30:00.000Z"); // 1 Esfand 1404
    expect(iso(p.to)).toBe("2026-03-20T20:30:00.000Z"); // 1 Farvardin 1405
    expect(p.label).toBe("ماه قبل (اسفند)");
  });
});
