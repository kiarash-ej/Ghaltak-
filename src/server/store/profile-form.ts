import * as z from "zod";
import { normalizeIranMobile, toEnglishDigits } from "@/lib/format";

// Parsing and validation of the store settings form (A6). Pure functions, no
// database.

export const STORE_NAME_MAX = 60;

export type FieldErrors = Record<string, string[]>;

// What each platform allows in a username.
// Instagram: letters, digits, "." and "_", up to 30, no leading/trailing or double dot.
// Telegram: letters, digits and "_", 5 to 32, starting with a letter.
const INSTAGRAM = /^(?!\.)(?!.*\.\.)(?!.*\.$)[A-Za-z0-9._]{1,30}$/;
const TELEGRAM = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;

const PROFILE_URL = {
  instagram: /^(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|instagr\.am)\/([^/?#]+)/i,
  telegram: /^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/([^/?#]+)/i,
};

/**
 * What sellers type or paste → the bare handle: "@shop", " shop ",
 * "https://instagram.com/shop/?igsh=…" and "t.me/shop" all become "shop".
 * The result is not validated yet.
 */
export function cleanHandle(input: string, platform: "instagram" | "telegram"): string {
  const trimmed = toEnglishDigits(input).trim();
  const fromUrl = trimmed.match(PROFILE_URL[platform])?.[1];
  return (fromUrl ?? trimmed).replace(/^@+/, "");
}

const text = (input: FormDataEntryValue | null) => (typeof input === "string" ? input : "");

const handle = (platform: "instagram" | "telegram", pattern: RegExp, message: string) =>
  z
    .string()
    .transform((v) => cleanHandle(v, platform))
    .refine((v) => v === "" || pattern.test(v), { error: message })
    .transform((v) => (v === "" ? null : v));

export const storeProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "نام فروشگاه را وارد کنید." })
    .max(STORE_NAME_MAX, { error: `نام فروشگاه حداکثر ${STORE_NAME_MAX} نویسه باشد.` }),
  contactPhone: z
    .string()
    .transform((v) => (v.trim() === "" ? "" : (normalizeIranMobile(v) ?? "invalid")))
    .refine((v) => v !== "invalid", { error: "شمارهٔ موبایل معتبر نیست. مثال: 09121234567" })
    .transform((v) => (v === "" ? null : v)),
  instagram: handle(
    "instagram",
    INSTAGRAM,
    "آیدی اینستاگرام فقط حروف انگلیسی، عدد، نقطه و زیرخط دارد (حداکثر ۳۰ نویسه).",
  ),
  telegram: handle(
    "telegram",
    TELEGRAM,
    "آیدی تلگرام ۵ تا ۳۲ نویسه است: حروف انگلیسی، عدد و زیرخط، و با حرف شروع می‌شود.",
  ),
});

export type StoreProfileInput = z.infer<typeof storeProfileSchema>;

export type ParsedStoreProfileForm =
  | { success: true; data: StoreProfileInput }
  | { success: false; errors: FieldErrors };

export function parseStoreProfileForm(formData: FormData): ParsedStoreProfileForm {
  const result = storeProfileSchema.safeParse({
    name: text(formData.get("name")),
    contactPhone: text(formData.get("contactPhone")),
    instagram: text(formData.get("instagram")),
    telegram: text(formData.get("telegram")),
  });
  if (result.success) return { success: true, data: result.data };

  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "form";
    (errors[key] ??= []).push(issue.message);
  }
  return { success: false, errors };
}
