import * as z from "zod";
import { formatNumber, normalizeIranMobile } from "@/lib/format";
import {
  MAX_LINES,
  mergeLines,
  parseQuantity,
  type FieldErrors,
  type OrderLineInput,
} from "./order-form";

// Validation of the PUBLIC purchase-link form (/buy/[token]). Everything here
// comes from an anonymous visitor, so every field is checked. Pure, no database.

/**
 * Most of one item a customer can order through a purchase link. Much lower
 * than the seller's manual form (MAX_QUANTITY): unpaid link orders hold stock
 * for up to 48 hours, so a high cap would let one visitor hold it all (#18).
 */
export const MAX_BUY_QUANTITY = 10;
const MAX_BUY_QUANTITY_FA = formatNumber(MAX_BUY_QUANTITY);

export type BuyInput = {
  name: string;
  phone: string;
  address: string;
  items: OrderLineInput[];
};

export type BuyParseResult =
  | { success: true; data: BuyInput }
  | { success: false; errors: FieldErrors };

const customerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "نام و نام خانوادگی را وارد کنید." })
    .max(80, { error: "نام حداکثر ۸۰ نویسه باشد." }),
  phone: z
    .string()
    .max(30)
    .transform((v) => normalizeIranMobile(v))
    .refine((v): v is string => v !== null, {
      error: "شمارهٔ موبایل معتبر نیست. مثال: ۰۹۱۲۱۲۳۴۵۶۷",
    }),
  address: z
    .string()
    .trim()
    .min(10, { error: "آدرس کامل را وارد کنید." })
    .max(500, { error: "آدرس حداکثر ۵۰۰ نویسه باشد." }),
});

const idSchema = z.string().trim().max(64).regex(/^[A-Za-z0-9_-]*$/);

function text(input: FormDataEntryValue | null): string {
  return typeof input === "string" ? input : "";
}

/**
 * Line fields are `items.<n>.variantId` and `items.<n>.quantity`, one line per
 * product on the page. A quantity of 0 (or empty) means "not buying this one".
 */
export function parseBuyForm(formData: FormData): BuyParseResult {
  const errors: FieldErrors = {};
  const addError = (key: string, message: string) => {
    (errors[key] ??= []).push(message);
  };

  const customer = customerSchema.safeParse({
    name: text(formData.get("name")),
    phone: text(formData.get("phone")),
    address: text(formData.get("address")),
  });
  if (!customer.success) {
    for (const issue of customer.error.issues) addError(String(issue.path[0]), issue.message);
  }

  const indexes = new Set<number>();
  for (const key of formData.keys()) {
    const match = key.match(/^items\.(\d{1,3})\.(?:variantId|quantity)$/);
    if (match) indexes.add(Number(match[1]));
  }
  if (indexes.size > MAX_LINES) {
    return { success: false, errors: { items: ["درخواست نامعتبر است."] } };
  }

  const lines: OrderLineInput[] = [];
  for (const i of [...indexes].sort((a, b) => a - b)) {
    const rawQty = text(formData.get(`items.${i}.quantity`)).trim();
    const quantity = rawQty === "" ? 0 : parseQuantity(rawQty);
    if (quantity === null) {
      addError(`items.${i}.quantity`, "تعداد معتبر نیست.");
      continue;
    }
    if (quantity > MAX_BUY_QUANTITY) {
      addError(`items.${i}.quantity`, `از هر کالا حداکثر ${MAX_BUY_QUANTITY_FA} عدد.`);
      continue;
    }
    if (quantity === 0) continue;

    const variantId = idSchema.safeParse(text(formData.get(`items.${i}.variantId`)));
    if (!variantId.success) {
      addError(`items.${i}.variantId`, "درخواست نامعتبر است.");
    } else if (variantId.data === "") {
      addError(`items.${i}.variantId`, "رنگ و سایز را انتخاب کنید.");
    } else {
      lines.push({ variantId: variantId.data, quantity });
    }
  }

  const items = mergeLines(lines);
  if (items.length === 0 && !Object.keys(errors).some((k) => k.startsWith("items."))) {
    addError("items", "حداقل یک کالا انتخاب کنید.");
  }
  // The same variant can appear on two lines; the cap applies to the total.
  if (items.some((l) => l.quantity > MAX_BUY_QUANTITY)) {
    addError("items", `از هر کالا حداکثر ${MAX_BUY_QUANTITY_FA} عدد.`);
  }

  if (Object.keys(errors).length > 0 || !customer.success) return { success: false, errors };
  return { success: true, data: { ...customer.data, items } };
}
