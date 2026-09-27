import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSeller } from "@/server/auth";
import { readReceipt } from "@/server/orders/receipt-storage";

// Serves an order's payment receipt to the seller who owns the order, and to
// nobody else. Receipts show card numbers, so they are never public or cached.
// `?v=<key>` (the payment panel): only that receipt; if the customer has sent
// another since, 404, so the seller never looks at a receipt other than the
// one their confirmation is checked against.
export async function GET(req: NextRequest, ctx: RouteContext<"/orders/[id]/receipt">) {
  const seller = await requireSeller();
  const { id } = await ctx.params;

  const order = await prisma.order.findFirst({
    where: { id, sellerId: seller.id },
    select: { receiptImageUrl: true },
  });
  const wanted = req.nextUrl.searchParams.get("v");
  if (wanted !== null && wanted !== order?.receiptImageUrl) return new Response("Not found", { status: 404 });
  const image = await readReceipt(order?.receiptImageUrl);
  if (!image) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(image.body), {
    headers: {
      "Content-Type": image.contentType,
      "Content-Length": String(image.body.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
