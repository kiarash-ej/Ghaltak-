import * as z from "zod";
import { toEnglishDigits } from "@/lib/format";

// Parsing and validation of the product form. Pure functions, no database.

export const MAX_PRICE = 2_000_000_000; // stays inside a Postgres Int (tomans)
export const MAX_STOCK = 1_000_000;
export const MAX_VARIANTS = 50;

export type FieldErrors = Record<string, string[]>;

/** "۱٬۲۵۰٬۰۰۰" / "1,250,000" / "1250000" -> 1250000. Null when not a whole number. */
export function parseWholeNumber(input: FormDataEntryValue | null): number | null {
  if (typeof input !== "string") return null;
  const cleaned = toEnglishDigits(input).replace(/[,٬،\s]/g, "");
  if (!/^\d{1,10}$/.test(cleaned)) return null;
  return Number(cleaned);
}

function text(input: FormDataEntryValue | null): string {
  return typeof input === "string" ? input : "";
}

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} حداکثر ${max} نویسه باشد.` })
    .transform((v) => (v === "" ? null : v));

const variantSchema = z.object({
  id: z.string().min(1).nullable(),
  color: optionalText(40, "رنگ"),
  size: optionalText(40, "سایز"),
  sku: optionalText(60, "کد کالا"),
  stock: z
    .number({ error: "موجودی را به‌صورت عدد وارد کنید." })
    .int()
    .min(0, { error: "موجودی نمی‌تواند منفی باشد." })
    .max(MAX_STOCK, { error: "موجودی بیش از حد مجاز است." }),
});

export const productSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { error: "نام محصول را وارد کنید." })
      .max(120, { error: "نام محصول حداکثر ۱۲۰ نویسه باشد." }),
    price: z
      .number({ error: "قیمت را به‌صورت عدد (تومان) وارد کنید." })
      .int()
      .min(1, { error: "قیمت باید بیشتر از صفر باشد." })
      .max(MAX_PRICE, { error: "قیمت بیش از حد مجاز است." }),
    category: optionalText(60, "دسته‌بندی"),
    isActive: z.boolean(),
    lowStockThreshold: z
      .number({ error: "آستانهٔ کم‌موجودی را به‌صورت عدد وارد کنید." })
      .int()
      .min(0)
      .max(10_000),
    variants: z
      .array(variantSchema)
      .min(1, { error: "حداقل یک تنوع (رنگ/سایز) لازم است." })
      .max(MAX_VARIANTS, { error: `حداکثر ${MAX_VARIANTS} تنوع مجاز است.` }),
  })
  .superRefine((value, ctx) => {
    const combos = new Map<string, number>();
    const skus = new Map<string, number>();
    value.variants.forEach((v, i) => {
      const combo = `${(v.color ?? "").toLowerCase()}|${(v.size ?? "").toLowerCase()}`;
      if (combos.has(combo)) {
        ctx.addIssue({
          code: "custom",
          path: ["variants", i, "color"],
          message: "این ترکیب رنگ و سایز تکراری است.",
        });
      }
      combos.set(combo, i);

      if (v.sku) {
        const key = v.sku.toLowerCase();
        if (skus.has(key)) {
          ctx.addIssue({
            code: "custom",
            path: ["variants", i, "sku"],
            message: "این کد کالا در همین فرم تکراری است.",
          });
        }
        skus.set(key, i);
      }
    });
  });

export type ProductInput = z.infer<typeof productSchema>;

export type ParsedProductForm =
  | { success: true; data: ProductInput }
  | { success: false; errors: FieldErrors };

/** Reads the product form. Variant fields arrive as parallel arrays (one entry per row). */
export function parseProductForm(formData: FormData): ParsedProductForm {
  const ids = formData.getAll("variantId");
  const colors = formData.getAll("variantColor");
  const sizes = formData.getAll("variantSize");
  const skus = formData.getAll("variantSku");
  const stocks = formData.getAll("variantStock");

  const variants = ids.map((id, i) => ({
    id: text(id) || null,
    color: text(colors[i] ?? null),
    size: text(sizes[i] ?? null),
    sku: text(skus[i] ?? null),
    // Existing variants do not submit a stock value (it is read-only on edit).
    stock: text(stocks[i] ?? null) === "" ? 0 : parseWholeNumber(stocks[i] ?? null),
  }));

  const result = productSchema.safeParse({
    name: text(formData.get("name")),
    price: parseWholeNumber(formData.get("price")),
    category: text(formData.get("category")),
    isActive: formData.get("isActive") === "on",
    lowStockThreshold:
      text(formData.get("lowStockThreshold")) === ""
        ? 3
        : parseWholeNumber(formData.get("lowStockThreshold")),
    variants,
  });

  if (result.success) return { success: true, data: result.data };

  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "form";
    (errors[key] ??= []).push(issue.message);
  }
  return { success: false, errors };
}
