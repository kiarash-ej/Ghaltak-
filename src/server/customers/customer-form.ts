import * as z from "zod";
import { normalizeIranMobile } from "@/lib/format";

// Parsing of the customer edit form. Pure, no database.
// The tag is NOT part of this form: it has its own control on the profile
// (setCustomerTagAction), so two controls never write the same field.

export type FieldErrors = Record<string, string[]>;

export type CustomerInput = {
  name: string | null;
  phone: string; // normalized 09xxxxxxxxx
  address: string | null;
};

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} حداکثر ${max.toLocaleString("fa-IR")} نویسه باشد.` })
    .transform((v) => (v === "" ? null : v));

const schema = z.object({
  name: optionalText(80, "نام"),
  phone: z
    .string()
    .max(30)
    .transform((v) => normalizeIranMobile(v))
    .refine((v): v is string => v !== null, {
      error: "شمارهٔ موبایل معتبر نیست. مثال: ۰۹۱۲۱۲۳۴۵۶۷",
    }),
  address: optionalText(500, "آدرس"),
});

export function parseCustomerForm(
  formData: FormData,
): { success: true; data: CustomerInput } | { success: false; errors: FieldErrors } {
  const text = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" ? v : "";
  };
  const result = schema.safeParse({
    name: text("name"),
    phone: text("phone"),
    address: text("address"),
  });
  if (result.success) return { success: true, data: result.data };

  const errors: FieldErrors = {};
  for (const issue of result.error.issues) (errors[String(issue.path[0] ?? "form")] ??= []).push(issue.message);
  return { success: false, errors };
}
