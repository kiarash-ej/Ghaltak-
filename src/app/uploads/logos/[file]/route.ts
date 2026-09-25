import type { NextRequest } from "next/server";
import { publicImageResponse } from "@/server/storage/public-images";
import { readStoreLogo } from "@/server/store/logo";

// Serves store logos from the file storage. Public on purpose: a store's logo
// is shown on its public purchase pages. Names are validated random UUIDs, as
// for product images.
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/uploads/logos/[file]">,
) {
  const { file } = await ctx.params;
  return publicImageResponse(await readStoreLogo(file));
}
