// Persian formatting helpers. Amounts are integer tomans everywhere in the app;
// format only at the display edge.

// Dates are stored in UTC and always shown in Iran time, whatever time zone
// the server runs in (production servers are usually UTC).
export const APP_TIME_ZONE = "Asia/Tehran";

const numberFormat = new Intl.NumberFormat("fa-IR");
const jalaliDate = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: APP_TIME_ZONE,
});
const jalaliDateTime = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: APP_TIME_ZONE,
});

/** 1250000 -> "۱٬۲۵۰٬۰۰۰" */
export function formatNumber(n: number | bigint): string {
  return numberFormat.format(n);
}

/** 1250000 -> "۱٬۲۵۰٬۰۰۰ تومان" */
export function formatToman(amount: number | bigint): string {
  return `${formatNumber(amount)} تومان`;
}

/** Date -> "۳ مهر ۱۴۰۵" */
export function formatDate(date: Date | string | number): string {
  return jalaliDate.format(new Date(date));
}

/** Date -> "۳ مهر ۱۴۰۵، ۱۴:۳۰" */
export function formatDateTime(date: Date | string | number): string {
  return jalaliDateTime.format(new Date(date));
}

/** Converts Persian/Arabic digits to ASCII so user input can be parsed. */
export function toEnglishDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

/**
 * Normalizes an Iranian mobile number to "09xxxxxxxxx".
 * Accepts "09121234567", "+989121234567", "00989121234567", "9121234567"
 * and Persian digits. Returns null when it is not a valid mobile number.
 */
export function normalizeIranMobile(input: string): string | null {
  const digits = toEnglishDigits(input).replace(/[\s\-()]/g, "");
  const match = digits.match(/^(?:\+98|0098|98|0)?(9\d{9})$/);
  return match ? `0${match[1]}` : null;
}
