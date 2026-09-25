import "server-only";
import { randomUUID } from "node:crypto";
import { sniffImageType } from "@/server/catalog/image-type";
import { CONTENT_TYPES, isValidKey, storage, type StoredObject } from "@/server/storage";

// Payment receipt images. PRIVATE: receipts show bank card numbers, so they
// live in the storage's private bucket and are only served by
// /orders/[id]/receipt to the seller who owns the order.
//
// Order.receiptImageUrl holds the storage key ("receipts/<uuid>.<ext>"), not
// a public URL. Phase 1 wrote the same keys under uploads/receipts, which is
// exactly where the local driver keeps them, so old receipts keep working;
// on S3 they are copied once with `npm run storage:migrate-receipts`.

export const MAX_RECEIPT_BYTES = 2 * 1024 * 1024;
const BUCKET = "private";
const KEY_PREFIX = "receipts/";

export type SaveReceiptResult = { ok: true; key: string } | { ok: false; error: string };

function isReceiptKey(key: string | null | undefined): key is string {
  return typeof key === "string" && key.startsWith(KEY_PREFIX) && isValidKey(key);
}

export async function saveReceipt(file: File): Promise<SaveReceiptResult> {
  if (file.size === 0) return { ok: false, error: "تصویر رسید را انتخاب کنید." };
  if (file.size > MAX_RECEIPT_BYTES) {
    return { ok: false, error: "حجم تصویر رسید باید کمتر از ۲ مگابایت باشد." };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = sniffImageType(bytes);
  if (!ext) return { ok: false, error: "فقط تصویر JPG، PNG یا WebP مجاز است." };

  const key = `${KEY_PREFIX}${randomUUID()}.${ext}`;
  try {
    await storage().put(BUCKET, key, bytes, CONTENT_TYPES[ext]);
  } catch (err) {
    console.error("receipt save failed:", (err as Error)?.name);
    return { ok: false, error: "ذخیرهٔ تصویر رسید انجام نشد. کمی بعد دوباره تلاش کنید." };
  }
  return { ok: true, key };
}

/** Deletes a receipt saved by saveReceipt. Ignores anything else; never throws. */
export async function deleteReceipt(key: string | null | undefined) {
  if (!isReceiptKey(key)) return;
  try {
    await storage().delete(BUCKET, key);
  } catch (err) {
    // The order change already happened; a leftover file is harmless.
    console.error("receipt delete failed:", (err as Error)?.name);
  }
}

/** Reads a receipt for serving. Only receipt keys are accepted (no path tricks). */
export async function readReceipt(key: string | null | undefined): Promise<StoredObject | null> {
  if (!isReceiptKey(key)) return null;
  return storage().get(BUCKET, key);
}
