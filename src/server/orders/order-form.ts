import * as z from "zod";
import { normalizeIranMobile, toEnglishDigits } from "@/lib/format";

// Parsing and validation of the manual order form, plus order totals.
// Pure functions, no database.

export const MAX_LINES = 50;
export const MAX_QUANTITY = 1000;
export const MAX_ORDER_TOTAL = 2_000_000_000; // stays inside a Postgres Int (tomans)

export type FieldErrors = Record<string, string[]>;

export type OrderLineInput = { variantId: string; quantity: number };

export type OrderInput = {
  customer:
    | { kind: "existing"; id: string }
    | { kind: "new"; name: string; phone: string };
  shippingAddress: string | null;
  items: OrderLineInput[];
};

export type ParseResult =
  | { success: true; data: OrderInput }
  | { success: false; errors: FieldErrors };

function text(input: FormDataEntryValue | null): string {
  return typeof input === "string" ? input : "";
}

/** "۳" / "3" -> 3. Null unless it is a whole number. */
export function parseQuantity(input: FormDataEntryValue | null): number | null {
  const cleaned = toEnglishDigits(text(input)).trim();
  if (!/^\d{1,6}$/.test(cleaned)) return null;
  return Number(cleaned);
}

/** Adds up quantities of lines that point at the same variant. Keeps first-seen order. */
export function mergeLines(lines: OrderLineInput[]): OrderLineInput[] {
  const merged = new Map<string, number>();
  for (const line of lines) {
    merged.set(line.variantId, (merged.get(line.variantId) ?? 0) + line.quantity);
  }
  return [...merged].map(([variantId, quantity]) => ({ variantId, quantity }));
}

/** Sum of unitPrice × quantity, in tomans. */
export function computeOrderTotal(lines: { unitPrice: number; quantity: number }[]): number {
  return lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
}

const newCustomerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "نام مشتری را وارد کنید." })
    .max(80, { error: "نام مشتری حداکثر ۸۰ نویسه باشد." }),
  phone: z
    .string()
    .transform((v) => normalizeIranMobile(v))
    .refine((v): v is string => v !== null, {
      error: "شمارهٔ موبایل معتبر نیست. مثال: ۰۹۱۲۱۲۳۴۵۶۷",
    }),
});

const addressSchema = z
  .string()
  .trim()
  .max(500, { error: "آدرس حداکثر ۵۰۰ نویسه باشد." })
  .transform((v) => (v === "" ? null : v));

/**
 * Reads the manual order form. Line fields are named `items.<n>.variantId`
 * and `items.<n>.quantity`; blank lines (no variant chosen) are ignored.
 */
export function parseOrderForm(formData: FormData): ParseResult {
  const errors: FieldErrors = {};
  const addError = (key: string, message: string) => {
    (errors[key] ??= []).push(message);
  };

  // Customer
  let customer: OrderInput["customer"] | null = null;
  if (text(formData.get("customerMode")) === "new") {
    const parsed = newCustomerSchema.safeParse({
      name: text(formData.get("customerName")),
      phone: text(formData.get("customerPhone")),
    });
    if (parsed.success) {
      customer = { kind: "new", ...parsed.data };
    } else {
      for (const issue of parsed.error.issues) {
        addError(issue.path[0] === "name" ? "customerName" : "customerPhone", issue.message);
      }
    }
  } else {
    const id = text(formData.get("customerId")).trim();
    if (id) customer = { kind: "existing", id };
    else addError("customerId", "یک مشتری انتخاب کنید یا مشتری جدید بسازید.");
  }

  // Address
  const address = addressSchema.safeParse(text(formData.get("shippingAddress")));
  if (!address.success) addError("shippingAddress", address.error.issues[0].message);

  // Lines
  const indexes = new Set<string>();
  for (const key of formData.keys()) {
    const match = key.match(/^items\.(\d+)\.variantId$/);
    if (match) indexes.add(match[1]);
  }
  const lines: OrderLineInput[] = [];
  for (const i of [...indexes].sort((a, b) => Number(a) - Number(b))) {
    const variantId = text(formData.get(`items.${i}.variantId`)).trim();
    if (!variantId) continue;
    const quantity = parseQuantity(formData.get(`items.${i}.quantity`));
    if (quantity === null || quantity < 1) {
      addError(`items.${i}.quantity`, "تعداد باید عددی بزرگ‌تر از صفر باشد.");
    } else if (quantity > MAX_QUANTITY) {
      addError(`items.${i}.quantity`, "تعداد بیش از حد مجاز است.");
    } else {
      lines.push({ variantId, quantity });
    }
  }
  const items = mergeLines(lines);
  if (items.length === 0 && !Object.keys(errors).some((k) => k.startsWith("items."))) {
    addError("items", "حداقل یک کالا به سفارش اضافه کنید.");
  }
  if (items.length > MAX_LINES) addError("items", `حداکثر ${MAX_LINES} ردیف کالا مجاز است.`);
  if (items.some((l) => l.quantity > MAX_QUANTITY)) {
    addError("items", "تعداد یک کالا بیش از حد مجاز است.");
  }

  if (Object.keys(errors).length > 0 || !customer || !address.success) {
    return { success: false, errors };
  }
  return { success: true, data: { customer, shippingAddress: address.data, items } };
}
