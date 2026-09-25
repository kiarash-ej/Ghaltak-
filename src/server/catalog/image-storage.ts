import "server-only";
import { randomUUID } from "node:crypto";
import { isValidKey, storage, type StoredObject } from "@/server/storage";
import { CONTENT_TYPES, sniffImageType } from "./image-type";

// Product images, in the "public" bucket of the file storage (src/server/storage):
// local disk in development, S3 in production (STORAGE_DRIVER).
//
// URLs stay "/uploads/products/<uuid>.<ext>" as in Phase 1. The route of that
// name reads from storage, so switching drivers changes no database row.

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const URL_PREFIX = "/uploads/products/";

/** "<uuid>.<ext>" → its storage key, or null for any other name. */
function keyOf(name: string): string | null {
  const key = `products/${name}`;
  return isValidKey(key) ? key : null;
}

export type SaveImageResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export async function saveProductImage(file: File): Promise<SaveImageResult> {
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "حجم تصویر باید کمتر از ۲ مگابایت باشد." };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = sniffImageType(bytes);
  if (!ext) {
    return { ok: false, error: "فقط تصویر JPG، PNG یا WebP مجاز است." };
  }

  const name = `${randomUUID()}.${ext}`;
  try {
    await storage().put("public", `products/${name}`, bytes, CONTENT_TYPES[ext]);
  } catch (err) {
    console.error("[image-storage] saving a product image failed", err);
    return { ok: false, error: "ذخیرهٔ تصویر انجام نشد. لطفاً دوباره تلاش کنید." };
  }
  return { ok: true, url: `${URL_PREFIX}${name}` };
}

/**
 * Deletes an image previously returned by saveProductImage. Ignores anything
 * else. Cleanup only: it runs after the database has changed, so a failure is
 * logged (the file stays as an orphan) and never fails the seller's request.
 */
export async function deleteProductImage(url: string | null | undefined) {
  if (!url?.startsWith(URL_PREFIX)) return;
  const key = keyOf(url.slice(URL_PREFIX.length));
  if (!key) return;
  try {
    await storage().delete("public", key);
  } catch (err) {
    console.error(`[image-storage] deleting ${key} failed`, err);
  }
}

/** Reads an image for serving. The name is validated, so path traversal is impossible. */
export async function readProductImage(name: string): Promise<StoredObject | null> {
  const key = keyOf(name);
  if (!key) return null;
  return storage().get("public", key);
}
