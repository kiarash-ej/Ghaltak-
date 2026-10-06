import { describe, expect, it } from "vitest";
import { briefDelta, compactToman, greeting } from "./brief-text";

describe("compactToman", () => {
  it("picks the unit a seller would say", () => {
    expect(compactToman(6_400_000)).toEqual({ value: 6.4, decimals: 1, unit: "میلیون تومان" });
    expect(compactToman(48_000_000)).toEqual({ value: 48, decimals: 0, unit: "میلیون تومان" });
    expect(compactToman(125_400_000)).toEqual({ value: 125, decimals: 0, unit: "میلیون تومان" });
    expect(compactToman(850_000)).toEqual({ value: 850, decimals: 0, unit: "هزار تومان" });
    expect(compactToman(2_300_000_000)).toEqual({ value: 2.3, decimals: 1, unit: "میلیارد تومان" });
    expect(compactToman(900)).toEqual({ value: 900, decimals: 0, unit: "تومان" });
    expect(compactToman(0)).toEqual({ value: 0, decimals: 0, unit: "تومان" });
  });

  it("rounds to one decimal and drops a useless .0", () => {
    expect(compactToman(6_449_999)).toEqual({ value: 6.4, decimals: 1, unit: "میلیون تومان" });
    expect(compactToman(7_000_000)).toEqual({ value: 7, decimals: 0, unit: "میلیون تومان" });
  });
});

describe("briefDelta", () => {
  it("compares with the same weekday last week", () => {
    expect(briefDelta(6_400_000, 5_300_000, "دوشنبه")).toEqual({ text: "▲ ۲۱٪ نسبت به دوشنبهٔ قبل", tone: "up" });
    expect(briefDelta(4_000_000, 5_000_000, "دوشنبه")).toEqual({ text: "▼ ۲۰٪ نسبت به دوشنبهٔ قبل", tone: "down" });
  });

  it("says nothing without a base to compare with, or when nothing changed", () => {
    expect(briefDelta(6_400_000, 0, "دوشنبه")).toBeNull();
    expect(briefDelta(5_000_000, 5_000_000, "دوشنبه")).toEqual({ text: "مثل دوشنبهٔ قبل", tone: "flat" });
  });
});

describe("greeting", () => {
  // Tehran is UTC+3:30.
  it("follows the Tehran clock", () => {
    expect(greeting(new Date("2026-10-06T04:30:00Z"))).toBe("صبح بخیر"); // 08:00
    expect(greeting(new Date("2026-10-06T09:00:00Z"))).toBe("ظهر بخیر"); // 12:30
    expect(greeting(new Date("2026-10-06T12:30:00Z"))).toBe("عصر بخیر"); // 16:00
    expect(greeting(new Date("2026-10-06T17:30:00Z"))).toBe("شب بخیر"); // 21:00
    expect(greeting(new Date("2026-10-06T00:00:00Z"))).toBe("شب بخیر"); // 03:30
  });
});
