import { toEnglishDigits } from "@/lib/format";

// The seller's card-to-card details (Phase 2, B6): validation and display.
// Pure, no database. Storing them encrypted is card-store.ts.

/** "6037-9912 3456 7893" / Persian digits -> "6037991234567893", or null if invalid. */
export function normalizeCardNumber(input: string): string | null {
  const digits = toEnglishDigits(input).replace(/[\s-]/g, "");
  if (!/^\d{16}$/.test(digits)) return null;
  return luhnValid(digits) ? digits : null;
}

/** Luhn checksum, which every Iranian bank card number (Shetab) satisfies. */
export function luhnValid(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/**
 * "ir82 0540 1026 ..." / Persian digits -> "IR820540102680020817909002", or
 * null if invalid. An Iranian Sheba is "IR" + 24 digits with a valid ISO 13616
 * (mod-97) check.
 */
export function normalizeSheba(input: string): string | null {
  const value = toEnglishDigits(input).replace(/[\s-]/g, "").toUpperCase();
  const withPrefix = /^\d{24}$/.test(value) ? `IR${value}` : value;
  if (!/^IR\d{24}$/.test(withPrefix)) return null;
  return ibanMod97(withPrefix) === 1 ? withPrefix : null;
}

function ibanMod97(iban: string): number {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  let remainder = 0;
  for (const digit of numeric) remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder;
}

/** "6037991234567893" -> "6037 9912 3456 7893" (shown left to right). */
export function formatCardNumber(digits: string): string {
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

/** "IR820540102680020817909002" -> "IR82 0540 1026 8002 0817 9090 02". */
export function formatSheba(sheba: string): string {
  return sheba.replace(/(.{4})(?=.)/g, "$1 ");
}

export type CardDetailsInput = {
  /** undefined = keep what is stored; null = remove; string = replace. */
  cardNumber?: string | null;
  cardHolder: string | null;
  sheba?: string | null;
};

export type CardDetailsParseResult =
  | { success: true; data: CardDetailsInput }
  | { success: false; errors: Record<string, string[]> };

function text(input: FormDataEntryValue | null): string {
  return typeof input === "string" ? input : "";
}

/**
 * Reads the «پرداخت» settings form. The card number and Sheba are never shown
 * again after saving, so an EMPTY field means "keep the saved one"; removing
 * them is an explicit checkbox.
 */
export function parseCardDetailsForm(
  formData: FormData,
  stored: { hasCard: boolean },
): CardDetailsParseResult {
  const errors: Record<string, string[]> = {};
  const data: CardDetailsInput = { cardHolder: null };

  if (formData.get("removeCard") === "on") {
    data.cardNumber = null;
  } else if (text(formData.get("cardNumber")).trim() !== "") {
    const card = normalizeCardNumber(text(formData.get("cardNumber")));
    if (card) data.cardNumber = card;
    else errors.cardNumber = ["شمارهٔ کارت معتبر نیست. ۱۶ رقم روی کارت را وارد کنید."];
  }

  if (formData.get("removeSheba") === "on") {
    data.sheba = null;
  } else if (text(formData.get("sheba")).trim() !== "") {
    const sheba = normalizeSheba(text(formData.get("sheba")));
    if (sheba) data.sheba = sheba;
    else errors.sheba = ["شمارهٔ شبا معتبر نیست. IR و ۲۴ رقم را وارد کنید."];
  }

  const holder = text(formData.get("cardHolder")).trim().replace(/\s+/g, " ");
  if (holder.length > 60) errors.cardHolder = ["نام صاحب کارت حداکثر ۶۰ نویسه باشد."];
  data.cardHolder = holder === "" ? null : holder;

  // Customers need a name to check before they transfer money.
  const willHaveCard = data.cardNumber === undefined ? stored.hasCard : data.cardNumber !== null;
  if (willHaveCard && !data.cardHolder && !errors.cardHolder) {
    errors.cardHolder = ["نام صاحب کارت را وارد کنید تا مشتری بتواند آن را بررسی کند."];
  }

  if (Object.keys(errors).length > 0) return { success: false, errors };
  return { success: true, data };
}
