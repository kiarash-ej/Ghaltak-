import { describe, expect, it } from "vitest";
import {
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

describe("number formatting", () => {
  it("uses Persian digits and grouping", () => {
    expect(formatNumber(1250000)).toBe("۱٬۲۵۰٬۰۰۰");
    expect(formatToman(1250000)).toBe("۱٬۲۵۰٬۰۰۰ تومان");
  });
});
