import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { CONTENT_TYPES, sniffImageType, type ImageExtension } from "./image-type";

// Product image storage. Local disk for now (UPLOAD_DIR, default ./uploads).
// To move to S3-compatible storage (Arvan/Liara), replace the bodies of the
// four exported functions; nothing else in the app touches the disk.

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");
const PRODUCT_DIR = path.join(UPLOAD_DIR, "products");
const URL_PREFIX = "/uploads/products/";
const FILE_PATTERN = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

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
  await mkdir(PRODUCT_DIR, { recursive: true });
  await writeFile(path.join(PRODUCT_DIR, name), bytes);
  return { ok: true, url: `${URL_PREFIX}${name}` };
}

/** Deletes an image previously returned by saveProductImage. Ignores anything else. */
export async function deleteProductImage(url: string | null | undefined) {
  if (!url?.startsWith(URL_PREFIX)) return;
  const name = url.slice(URL_PREFIX.length);
  if (!FILE_PATTERN.test(name)) return;
  try {
    await unlink(path.join(PRODUCT_DIR, name));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

/** Reads an image for serving. The name is validated, so path traversal is impossible. */
export async function readProductImage(
  name: string,
): Promise<{ body: Buffer; contentType: string } | null> {
  if (!FILE_PATTERN.test(name)) return null;
  const ext = name.split(".").pop() as ImageExtension;
  try {
    const body = await readFile(path.join(PRODUCT_DIR, name));
    return { body, contentType: CONTENT_TYPES[ext] };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}
