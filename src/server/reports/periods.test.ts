import { describe, expect, it } from "vitest";
import { lastDays, reportPeriods, tehranDateKey, tehranMidnight } from "./periods";

// 2026-09-24T16:53Z is Thursday 2 Mehr 1405, 20:23 in Tehran (UTC+3:30).
const now = new Date("2026-09-24T16:53:00Z");

describe("tehranMidnight", () => {
  it("is Tehran midnight, not UTC midnight", () => {
    expect(tehranMidnight(now).toISOString()).toBe("2026-09-23T20:30:00.000Z");
  });

  it("rolls over at Tehran midnight", () => {
    // 21:00Z on the 24th is already 00:30 on the 25th in Tehran.
    expect(tehranMidnight(new Date("2026-09-24T21:00:00Z")).toISOString()).toBe(
      "2026-09-24T20:30:00.000Z",
    );
  });
});

describe("reportPeriods", () => {
  it("starts the week on Saturday and the month on 1 Mehr", () => {
    const p = reportPeriods(now);
    expect(p.today.toISOString()).toBe("2026-09-23T20:30:00.000Z"); // Thu 2 Mehr
    expect(p.week.toISOString()).toBe("2026-09-18T20:30:00.000Z"); // Sat 28 Shahrivar
    expect(p.month.toISOString()).toBe("2026-09-22T20:30:00.000Z"); // Tue 1 Mehr
  });

  it("makes today the start of the week on a Saturday", () => {
    const saturday = new Date("2026-09-26T08:00:00Z"); // Sat 4 Mehr
    const p = reportPeriods(saturday);
    expect(p.week.toISOString()).toBe(p.today.toISOString());
  });

  it("makes today the start of the month on the 1st", () => {
    const first = new Date("2026-09-23T08:00:00Z"); // 1 Mehr
    const p = reportPeriods(first);
    expect(p.month.toISOString()).toBe(p.today.toISOString());
  });
});

describe("lastDays", () => {
  it("returns n Tehran days, oldest first, ending today", () => {
    const days = lastDays(now, 3);
    expect(days.map((d) => d.key)).toEqual(["2026-09-22", "2026-09-23", "2026-09-24"]);
    expect(days[2].start.toISOString()).toBe("2026-09-23T20:30:00.000Z");
  });
});

describe("tehranDateKey", () => {
  it("uses the Tehran calendar date", () => {
    expect(tehranDateKey(new Date("2026-09-24T21:00:00Z"))).toBe("2026-09-25");
  });
});
