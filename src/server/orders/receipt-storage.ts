import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { CONTENT_TYPES, sniffImageType, type ImageExtension } from "@/server/catalog/image-type";

// Payment receipt images. PRIVATE: receipts show bank card numbers, so they
// live outside the public /uploads/products folder and are only served by
// /orders/[id]/receipt to the seller who owns the order.
//
// Order.receiptImageUrl holds the storage key ("receipts/<uuid>.<ext>"), not
// a public URL. To move to S3-compatible storage, replace the bodies below.

export const MAX_RECEIPT_BYTES = 2 * 1024 * 1024;
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");
const RECEIPT_DIR = path.join(UPLOAD_DIR, "receipts");
const KEY_PREFIX = "receipts/";
const FILE_PATTERN = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

export type SaveReceiptResult = { ok: true; key: string } | { ok: false; error: string };

export async function saveReceipt(file: File): Promise<SaveReceiptResult> {
  if (file.size === 0) return { ok: false, error: "تصویر رسید را انتخاب کنید." };
  if (file.size > MAX_RECEIPT_BYTES) {
    return { ok: false, error: "حجم تصویر رسید باید کمتر از ۲ مگابایت باشد." };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = sniffImageType(bytes);
  if (!ext) return { ok: false, error: "فقط تصویر JPG، PNG یا WebP مجاز است." };

  const name = `${randomUUID()}.${ext}`;
  await mkdir(RECEIPT_DIR, { recursive: true });
  await writeFile(path.join(RECEIPT_DIR, name), bytes);
  return { ok: true, key: `${KEY_PREFIX}${name}` };
}

function fileName(key: string | null | undefined): string | null {
  if (!key?.startsWith(KEY_PREFIX)) return null;
  const name = key.slice(KEY_PREFIX.length);
  return FILE_PATTERN.test(name) ? name : null;
}

/** Deletes a receipt saved by saveReceipt. Ignores anything else. */
export async function deleteReceipt(key: string | null | undefined) {
  const name = fileName(key);
  if (!name) return;
  try {
    await unlink(path.join(RECEIPT_DIR, name));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

/** Reads a receipt for serving. The key is validated, so path traversal is impossible. */
export async function readReceipt(
  key: string | null | undefined,
): Promise<{ body: Buffer; contentType: string } | null> {
  const name = fileName(key);
  if (!name) return null;
  const ext = name.split(".").pop() as ImageExtension;
  try {
    return { body: await readFile(path.join(RECEIPT_DIR, name)), contentType: CONTENT_TYPES[ext] };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}
