import type { NextRequest } from "next/server";
import { readProductImage } from "@/server/catalog/image-storage";
import { publicImageResponse } from "@/server/storage/public-images";

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
  return publicImageResponse(await readProductImage(file));
}
