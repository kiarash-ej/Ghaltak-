import "server-only";
import type { OrderStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

// What counts as a sale, shared by Home, finance, the daily brief, the link
// funnel and the CSV export. Totals are aggregated in SQL and scoped by seller.
//
// Definitions:
// - A "sale" is an order that was paid and not canceled or returned:
//   PAID, PREPARING, SHIPPED, DELIVERED. It is counted on the day it was placed.
// - Amounts are Order.totalPrice: items only, shipping excluded.

export const SALE_STATUSES = ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] as const satisfies readonly OrderStatus[];

export type SalesSummary = { total: number; count: number; average: number };

/** Sales (the definition above) placed since `since`. Used by the dashboard home (Track C, C5). */
export async function salesSince(sellerId: string, since: Date): Promise<SalesSummary> {
  const agg = await prisma.order.aggregate({
    where: { sellerId, status: { in: [...SALE_STATUSES] }, createdAt: { gte: since } },
    _sum: { totalPrice: true },
    _count: { _all: true },
  });
  const total = agg._sum.totalPrice ?? 0;
  const count = agg._count._all;
  return { total, count, average: count > 0 ? Math.round(total / count) : 0 };
}
