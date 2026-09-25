// CSV for the data export (Phase 2, C6). Pure, no database.
//
// Files open in Excel on a Persian Windows: UTF-8 with a byte order mark (or
// Excel guesses the old Windows code page and shows garbage), CRLF line ends,
// and a comma between cells (RFC 4180).

export type CsvValue = string | number | null | undefined;

export const BOM = "﻿";

// Excel (and LibreOffice, Google Sheets) run a cell that starts with one of
// these as a formula. Tab and CR are on OWASP's list too.
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * One cell. Text that could start a formula gets a leading apostrophe: names
 * and addresses are typed by customers on the public buy page, so a name like
 * =HYPERLINK(...) must stay text. Numbers are ours and are written as they are.
 */
export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  // Excel turns a long run of digits (a tracking code) into 5.49E+19 and drops
  // a leading zero (an SKU like 007). ="…" makes it text; with only digits
  // inside, that formula can't do anything else.
  if (/^\d+$/.test(value) && (value.length >= 12 || (value.length > 1 && value.startsWith("0")))) {
    return `"=""${value}"""`;
  }
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvLine(values: CsvValue[]): string {
  return `${values.map(csvCell).join(",")}\r\n`;
}

/**
 * "09121234567" -> "0912 123 4567". Excel reads a bare 09121234567 as a number
 * and drops the leading zero; with spaces it stays text.
 */
export function formatPhone(phone: string): string {
  return /^09\d{9}$/.test(phone) ? `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}` : phone;
}

export const yesNo = (value: boolean) => (value ? "بله" : "خیر");
