import { describe, expect, it } from "vitest";
import { finishedPeriods, parseReportKey, previousPeriod, recapFor, reportRange } from "./report-periods";

// Tehran midnight of a Jalali day, as UTC instants (Tehran is UTC+3:30).
const MEHR_1 = new Date("2026-09-22T20:30:00Z");
const ABAN_1 = new Date("2026-10-22T20:30:00Z");

describe("report keys", () => {
  it("a month, a season and a year, with their bounds and labels", () => {
    expect(parseReportKey("1405-07")).toEqual({ key: "1405-07", kind: "month", label: "مهر ۱۴۰۵", from: MEHR_1, to: ABAN_1 });
    expect(parseReportKey("1405-s3")).toMatchObject({ kind: "season", label: "پاییز ۱۴۰۵", from: MEHR_1, to: new Date("2026-12-21T20:30:00Z") });
    expect(parseReportKey("1405")).toMatchObject({ kind: "year", label: "سال ۱۴۰۵", from: new Date("2026-03-20T20:30:00Z"), to: new Date("2027-03-20T20:30:00Z") });
    for (const bad of ["1405-13", "1405-s5", "14O5", "1405-7", "../1405"]) expect(parseReportKey(bad), bad).toBeNull();
  });

  it("the period before, across the year end", () => {
    expect(previousPeriod(parseReportKey("1405-01")!).key).toBe("1404-12");
    expect(previousPeriod(parseReportKey("1405-s1")!).key).toBe("1404-s4");
    expect(previousPeriod(parseReportKey("1405")!).key).toBe("1404");
    expect(reportRange(parseReportKey("1405-07")!)).toMatchObject({ label: "مهر ۱۴۰۵", compareLabel: "شهریور ۱۴۰۵", to: ABAN_1 });
  });
});

describe("finishedPeriods", () => {
  it("every month, season and year that ended since the first sale, newest first", () => {
    // First sale 20 Bahman 1404; today 14 Mehr 1405.
    const done = finishedPeriods(new Date("2026-02-09T10:00:00Z"), new Date("2026-10-06T08:30:00Z"));
    expect(done.month.map((p) => p.key)).toEqual(["1405-06", "1405-05", "1405-04", "1405-03", "1405-02", "1405-01", "1404-12", "1404-11"]);
    expect(done.season.map((p) => p.key)).toEqual(["1405-s2", "1405-s1", "1404-s4"]);
    expect(done.year.map((p) => p.key)).toEqual(["1404"]);
  });

  it("nothing has ended yet in a store's first month", () => {
    expect(finishedPeriods(new Date("2026-09-25T10:00:00Z"), new Date("2026-10-06T08:30:00Z"))).toEqual({ month: [], season: [], year: [] });
  });
});

describe("recapFor", () => {
  it("the month that ended, in the first 7 days of the next", () => {
    expect(recapFor(new Date("2026-10-28T08:30:00Z"))).toMatchObject({ period: { key: "1405-07" }, alsoEnded: [] }); // 6 Aban
    expect(recapFor(new Date("2026-10-30T08:30:00Z"))).toBeNull(); // 8 Aban
  });

  it("a season when its last month ended, with that month", () => {
    const recap = recapFor(new Date("2026-09-23T08:30:00Z")); // 1 Mehr
    expect(recap?.period.key).toBe("1405-s2");
    expect(recap?.alsoEnded.map((p) => p.key)).toEqual(["1405-06"]);
  });

  it("the year on Nowruz, with winter and Esfand", () => {
    const recap = recapFor(new Date("2027-03-21T08:30:00Z")); // 1 Farvardin 1406
    expect(recap?.period).toMatchObject({ key: "1405", label: "سال ۱۴۰۵" });
    expect(recap?.alsoEnded.map((p) => p.key)).toEqual(["1405-s4", "1405-12"]);
  });
});
