import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { OrderStatus } from "@/generated/prisma/enums";
import { APP_TIME_ZONE } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { ORDER_STATUSES, isOpenStatus } from "@/server/orders/status";
import { lastDays, reportPeriods, type ReportPeriods } from "./periods";

// Sales report. Every number is aggregated in SQL (never by loading all
// orders), every query is scoped by the seller, and days are Tehran days.
//
// Definitions (also shown on the page):
// - A "sale" is an order that was paid and not canceled or returned:
//   PAID, PREPARING, SHIPPED, DELIVERED. It is counted on the day it was placed.
// - Amounts are Order.totalPrice: items only, shipping excluded.

export const SALE_STATUSES = ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] as const satisfies readonly OrderStatus[];
const OPEN_STATUSES = ORDER_STATUSES.filter(isOpenStatus);

export const CHART_DAYS = 30;
const TOP_PRODUCTS = 5;
const LOW_STOCK_ROWS = 8;

const saleStatusSql = Prisma.join(SALE_STATUSES.map((s) => Prisma.sql`${s}::"OrderStatus"`));
// Stored timestamps are UTC; this is the order's calendar day in Tehran.
const tehranDay = Prisma.sql`(o."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${APP_TIME_ZONE})::date`;

export type SalesSummary = { total: number; count: number; average: number };

async function salesSince(sellerId: string, since: Date): Promise<SalesSummary> {
  const agg = await prisma.order.aggregate({
    where: { sellerId, status: { in: [...SALE_STATUSES] }, createdAt: { gte: since } },
    _sum: { totalPrice: true },
    _count: { _all: true },
  });
  const total = agg._sum.totalPrice ?? 0;
  const count = agg._count._all;
  return { total, count, average: count > 0 ? Math.round(total / count) : 0 };
}

export type DailySales = { key: string; start: Date; total: number; count: number };

async function dailySales(sellerId: string, now: Date): Promise<DailySales[]> {
  const days = lastDays(now, CHART_DAYS);
  const rows = await prisma.$queryRaw<{ day: string; total: bigint; count: bigint }[]>`
    SELECT to_char(${tehranDay}, 'YYYY-MM-DD') AS day,
           COALESCE(SUM(o."totalPrice"), 0) AS total,
           COUNT(*) AS count
    FROM "Order" o
    WHERE o."sellerId" = ${sellerId}
      AND o."status" IN (${saleStatusSql})
      AND o."createdAt" >= ${days[0].start}
    GROUP BY 1`;
  const byDay = new Map(rows.map((r) => [r.day, r]));
  return days.map((d) => ({
    ...d,
    total: Number(byDay.get(d.key)?.total ?? 0),
    count: Number(byDay.get(d.key)?.count ?? 0),
  }));
}

export type CustomerMix = { newCustomers: number; returningCustomers: number };

/**
 * Customers who bought this period: "new" if their first-ever purchase is in
 * the period, "returning" if they had bought before it.
 */
async function customerMix(sellerId: string, since: Date): Promise<CustomerMix> {
  const [row] = await prisma.$queryRaw<{ new_count: bigint; returning_count: bigint }[]>`
    SELECT COUNT(*) FILTER (WHERE first_sale >= ${since}) AS new_count,
           COUNT(*) FILTER (WHERE first_sale < ${since}) AS returning_count
    FROM (
      SELECT o."customerId", MIN(o."createdAt") AS first_sale
      FROM "Order" o
      WHERE o."sellerId" = ${sellerId} AND o."status" IN (${saleStatusSql})
      GROUP BY o."customerId"
      HAVING MAX(o."createdAt") >= ${since}
    ) buyers`;
  return {
    newCustomers: Number(row?.new_count ?? 0),
    returningCustomers: Number(row?.returning_count ?? 0),
  };
}

export type TopProduct = { productId: string; name: string; quantity: number; revenue: number };

async function topProducts(sellerId: string, since: Date): Promise<TopProduct[]> {
  const rows = await prisma.$queryRaw<
    { productId: string; name: string; quantity: bigint; revenue: bigint }[]
  >`
    SELECT p."id" AS "productId", p."name",
           SUM(i."quantity") AS quantity,
           SUM(i."quantity" * i."unitPrice") AS revenue
    FROM "OrderItem" i
    JOIN "Order" o ON o."id" = i."orderId"
    JOIN "Product" p ON p."id" = i."productId"
    WHERE o."sellerId" = ${sellerId} AND p."sellerId" = ${sellerId}
      AND o."status" IN (${saleStatusSql})
      AND o."createdAt" >= ${since}
    GROUP BY p."id", p."name"
    ORDER BY quantity DESC, revenue DESC, p."name" ASC
    LIMIT ${TOP_PRODUCTS}`;
  return rows.map((r) => ({ ...r, quantity: Number(r.quantity), revenue: Number(r.revenue) }));
}

export type LowStockRow = {
  variantId: string;
  productName: string;
  color: string | null;
  size: string | null;
  stock: number;
  lowStockThreshold: number;
};

/** Same rule as Track A's inventory page: stock at or below the product's threshold. */
async function lowStock(sellerId: string): Promise<{ rows: LowStockRow[]; total: number }> {
  const where = Prisma.sql`v."sellerId" = ${sellerId} AND p."sellerId" = ${sellerId}
    AND p."isActive" AND v."stock" <= p."lowStockThreshold"`;
  const [rows, [{ total }]] = await Promise.all([
    prisma.$queryRaw<LowStockRow[]>`
      SELECT v."id" AS "variantId", p."name" AS "productName", v."color", v."size",
             v."stock", p."lowStockThreshold"
      FROM "ProductVariant" v JOIN "Product" p ON p."id" = v."productId"
      WHERE ${where}
      ORDER BY v."stock" ASC, p."name" ASC, v."id" ASC
      LIMIT ${LOW_STOCK_ROWS}`,
    prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(*) AS total
      FROM "ProductVariant" v JOIN "Product" p ON p."id" = v."productId"
      WHERE ${where}`,
  ]);
  return { rows, total: Number(total) };
}

async function openOrders(sellerId: string): Promise<{ status: OrderStatus; count: number }[]> {
  const groups = await prisma.order.groupBy({
    by: ["status"],
    where: { sellerId, status: { in: OPEN_STATUSES } },
    _count: { _all: true },
  });
  const byStatus = new Map(groups.map((g) => [g.status, g._count._all]));
  return OPEN_STATUSES.map((status) => ({ status, count: byStatus.get(status) ?? 0 }));
}

export type SalesReport = {
  periods: ReportPeriods;
  today: SalesSummary;
  week: SalesSummary;
  month: SalesSummary;
  daily: DailySales[];
  customers: CustomerMix;
  topProducts: TopProduct[];
  lowStock: { rows: LowStockRow[]; total: number };
  openOrders: { status: OrderStatus; count: number }[];
};

export async function getSalesReport(sellerId: string, now = new Date()): Promise<SalesReport> {
  const periods = reportPeriods(now);
  const [today, week, month, daily, customers, top, low, open] = await Promise.all([
    salesSince(sellerId, periods.today),
    salesSince(sellerId, periods.week),
    salesSince(sellerId, periods.month),
    dailySales(sellerId, now),
    customerMix(sellerId, periods.month),
    topProducts(sellerId, periods.month),
    lowStock(sellerId),
    openOrders(sellerId),
  ]);
  return { periods, today, week, month, daily, customers, topProducts: top, lowStock: low, openOrders: open };
}
