import type { NextRequest } from "next/server";
import { readProductImage } from "@/server/catalog/image-storage";

// Serves uploaded product images from the file storage (local disk or S3, see
// src/server/storage), at the same URL as in Phase 1. Public on purpose: the
// same images appear on the public purchase-link pages. File names are random
// UUIDs and validated against a strict pattern, so this cannot be used to read
// other files.
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/uploads/products/[file]">,
) {
  const { file } = await ctx.params;
  const image = await readProductImage(file);
  if (!image) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(image.body), {
    headers: {
      "Content-Type": image.contentType,
      "Content-Length": String(image.body.length),
      // The name is a random UUID that never changes content, so cache hard.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
