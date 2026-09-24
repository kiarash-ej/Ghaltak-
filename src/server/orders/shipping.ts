import * as z from "zod";
import type { OrderStatus, ShippingStatus } from "@/generated/prisma/enums";
import { toEnglishDigits } from "@/lib/format";

// Shipping rules and form parsing. Pure, no database.

export const SHIPPING_METHODS = ["POST", "COURIER", "IN_PERSON"] as const;
export type ShippingMethod = (typeof SHIPPING_METHODS)[number];

export const SHIPPING_METHOD_LABELS: Record<ShippingMethod, string> = {
  POST: "پست",
  COURIER: "پیک",
  IN_PERSON: "تحویل حضوری",
};

export const SHIPPING_STATUS_LABELS: Record<ShippingStatus, string> = {
  NOT_SHIPPED: "ارسال نشده",
  IN_TRANSIT: "در راه",
  DELIVERED: "تحویل داده شد",
  FAILED: "ارسال ناموفق",
};

export const MAX_SHIPPING_COST = 100_000_000; // tomans

export function isShippingMethod(value: unknown): value is ShippingMethod {
  return typeof value === "string" && (SHIPPING_METHODS as readonly string[]).includes(value);
}

/** Display label. Older rows may hold free text (e.g. "پست پیشتاز"): shown as is. */
export function shippingMethodLabel(value: string | null): string | null {
  if (!value) return null;
  return isShippingMethod(value) ? SHIPPING_METHOD_LABELS[value] : value;
}

/** Why an order can't be marked SHIPPED yet, or null when it can. */
export function shipBlocker(order: { shippingMethod: string | null }): string | null {
  return order.shippingMethod ? null : "برای ارسال، ابتدا روش ارسال را ثبت کنید.";
}

/**
 * The shipping status that goes with a new order status, or undefined to
 * leave it alone. Keeps the two in step when the seller changes the order.
 */
export function shippingStatusFor(to: OrderStatus): ShippingStatus | undefined {
  if (to === "SHIPPED") return "IN_TRANSIT";
  if (to === "DELIVERED") return "DELIVERED";
  return undefined;
}

export type ShippingInput = {
  method: ShippingMethod;
  cost: number | null;
  trackingCode: string | null;
  /** Only IN_TRANSIT/FAILED can be set by hand; DELIVERED comes from the order status. */
  shippingStatus: "IN_TRANSIT" | "FAILED" | null;
};

export type ShippingParseResult =
  | { success: true; data: ShippingInput }
  | { success: false; errors: Record<string, string[]> };

const schema = z.object({
  method: z.enum(SHIPPING_METHODS, { error: "روش ارسال را انتخاب کنید." }),
  cost: z
    .string()
    .transform((v) => toEnglishDigits(v).replace(/[,٬،\s]/g, ""))
    .refine((v) => v === "" || /^\d{1,9}$/.test(v), { error: "هزینه را به‌صورت عدد (تومان) وارد کنید." })
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || v <= MAX_SHIPPING_COST, { error: "هزینهٔ ارسال بیش از حد مجاز است." }),
  trackingCode: z
    .string()
    .transform((v) => toEnglishDigits(v).trim().toUpperCase())
    .refine((v) => v === "" || /^[A-Z0-9-]{4,40}$/.test(v), {
      error: "کد رهگیری فقط شامل عدد و حروف انگلیسی باشد (۴ تا ۴۰ نویسه).",
    })
    .transform((v) => (v === "" ? null : v)),
  shippingStatus: z
    .enum(["", "IN_TRANSIT", "FAILED"], { error: "وضعیت ارسال نامعتبر است." })
    .transform((v) => (v === "" ? null : v)),
});

function text(input: FormDataEntryValue | null): string {
  return typeof input === "string" ? input : "";
}

export function parseShippingForm(formData: FormData): ShippingParseResult {
  const parsed = schema.safeParse({
    method: text(formData.get("method")),
    cost: text(formData.get("cost")),
    trackingCode: text(formData.get("trackingCode")),
    shippingStatus: text(formData.get("shippingStatus")),
  });
  if (parsed.success) return { success: true, data: parsed.data };

  const errors: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) (errors[String(issue.path[0])] ??= []).push(issue.message);
  return { success: false, errors };
}
