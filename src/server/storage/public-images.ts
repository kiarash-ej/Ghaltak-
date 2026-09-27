import "server-only";
import { randomUUID } from "node:crypto";
import { sniffImageType } from "@/server/catalog/image-type";
import type { StoredObject } from "./drivers";
import { storage } from "./index";
import { CONTENT_TYPES, isValidKey } from "./keys";
import { errorSummary } from "@/lib/error-summary";

// Images anyone may see (product photos, store logos), in the "public" bucket.
// The app serves each folder itself at /uploads/<folder>/<uuid>.<ext>, the
// same URLs as Phase 1, so switching drivers changes no database row.

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export type SaveImageResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export type PublicImageFolder = "products" | "logos";

export function publicImages(folder: PublicImageFolder) {
  const urlPrefix = `/uploads/${folder}/`;

  /** "<uuid>.<ext>" → its storage key, or null for any other name. */
  const keyOf = (name: string): string | null => {
    const key = `${folder}/${name}`;
    return isValidKey(key) ? key : null;
  };

  return {
    /** Checks size and real type (from the bytes, not the browser's claim), then stores. */
    async save(file: File): Promise<SaveImageResult> {
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
        await storage().put("public", `${folder}/${name}`, bytes, CONTENT_TYPES[ext]);
      } catch (err) {
        console.error(`[public-images] saving to ${folder} failed`, errorSummary(err));
        return { ok: false, error: "ذخیرهٔ تصویر انجام نشد. لطفاً دوباره تلاش کنید." };
      }
      return { ok: true, url: `${urlPrefix}${name}` };
    },

    /**
     * Deletes an image previously returned by save(). Ignores anything else.
     * Cleanup only: it runs after the database has changed, so a failure is
     * logged (the file stays as an orphan) and never fails the request.
     */
    async remove(url: string | null | undefined): Promise<void> {
      if (!url?.startsWith(urlPrefix)) return;
      const key = keyOf(url.slice(urlPrefix.length));
      if (!key) return;
      try {
        await storage().delete("public", key);
      } catch (err) {
        console.error(`[public-images] deleting ${key} failed`, errorSummary(err));
      }
    },

    /** Reads an image for serving. The name is validated, so path traversal is impossible. */
    async read(name: string): Promise<StoredObject | null> {
      const key = keyOf(name);
      if (!key) return null;
      return storage().get("public", key);
    },
  };
}

/** The HTTP response for a public image (the /uploads/... routes). */
export function publicImageResponse(image: StoredObject | null): Response {
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(image.body), {
    headers: {
      "Content-Type": image.contentType,
      "Content-Length": String(image.body.length),
      // A name is a random UUID that never changes content, so cache hard.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
