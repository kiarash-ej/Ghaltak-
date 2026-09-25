import type { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { requireSeller } from "@/server/auth";
import { canExport, loginRole } from "@/server/exports/access";
import { CUSTOMER_HEADER, customerRows } from "@/server/exports/customers";
import { formatJalaliDate } from "@/server/exports/jalali";
import { ORDER_HEADER, orderRows, parseOrderFilter } from "@/server/exports/orders";
import { PRODUCT_HEADER, productRows } from "@/server/exports/products";
import { csvResponse } from "@/server/exports/stream";

// The CSV downloads of «خروجی داده» (C6). Owner only, checked here on the
// server; every row is scoped by the seller from requireSeller().
export async function GET(req: NextRequest, ctx: RouteContext<"/settings/data/export/[kind]">) {
  const seller = await requireSeller();
  if (!canExport(await loginRole(seller))) {
    return new Response("Only the store owner can export data.", { status: 403 });
  }

  const { kind } = await ctx.params;
  const stamp = formatJalaliDate(new Date()).replaceAll("/", "-");

  switch (kind) {
    case "products":
      return csvResponse(`ghaltak-products-${stamp}.csv`, PRODUCT_HEADER, productRows(seller.id));
    case "customers":
      return csvResponse(`ghaltak-customers-${stamp}.csv`, CUSTOMER_HEADER, customerRows(seller.id));
    case "orders": {
      const parsed = parseOrderFilter(req.nextUrl.searchParams);
      if (!parsed.ok) redirect(`/settings/data?error=${parsed.error}`);
      return csvResponse(`ghaltak-orders-${stamp}.csv`, ORDER_HEADER, orderRows(seller.id, parsed.filter));
    }
    default:
      return new Response("Not found", { status: 404 });
  }
}
