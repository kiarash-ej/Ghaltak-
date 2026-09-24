import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatToman,
  normalizeIranMobile,
  toEnglishDigits,
} from "./format";

describe("normalizeIranMobile", () => {
  it.each([
    ["09121234567", "09121234567"],
    ["9121234567", "09121234567"],
    ["+989121234567", "09121234567"],
    ["00989121234567", "09121234567"],
    ["۰۹۱۲۱۲۳۴۵۶۷", "09121234567"],
    ["0912 123 4567", "09121234567"],
    ["0912-123-4567", "09121234567"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeIranMobile(input)).toBe(expected);
  });

  it.each(["", "abc", "0212345678", "0912123456", "091212345678", "08121234567"])(
    "rejects %s",
    (input) => {
      expect(normalizeIranMobile(input)).toBeNull();
    },
  );
});

describe("toEnglishDigits", () => {
  it("converts Persian and Arabic-Indic digits", () => {
    expect(toEnglishDigits("۱۲۳٤٥٦")).toBe("123456");
  });
});

describe("date formatting", () => {
  it("shows Iran time and the Jalali calendar regardless of the server time zone", () => {
    // 16:53 UTC = 20:23 in Tehran (UTC+3:30), 2 Mehr 1405.
    const d = new Date("2026-09-24T16:53:00Z");
    expect(formatDateTime(d)).toContain("۲۰:۲۳");
    expect(formatDate(d)).toBe("۲ مهر ۱۴۰۵");
  });

  it("rolls the date over at Tehran midnight, not UTC midnight", () => {
    // 21:00 UTC on 24 Sep is already 00:30 on 25 Sep (3 Mehr) in Tehran.
    expect(formatDate(new Date("2026-09-24T21:00:00Z"))).toBe("۳ مهر ۱۴۰۵");
  });
});

describe("number formatting", () => {
  it("uses Persian digits and grouping", () => {
    expect(formatNumber(1250000)).toBe("۱٬۲۵۰٬۰۰۰");
    expect(formatToman(1250000)).toBe("۱٬۲۵۰٬۰۰۰ تومان");
  });
});
