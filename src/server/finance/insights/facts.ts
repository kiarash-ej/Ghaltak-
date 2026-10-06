import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { APP_TIME_ZONE } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getLinkFunnel } from "@/server/reports/link-funnel";
import { tehranMidnight } from "@/server/reports/periods";
import { SALE_STATUSES } from "@/server/reports/queries";
import type { FinanceRange } from "../periods";
import { dayKeys, type FinanceTotals } from "../summary";
import type { InsightFacts } from "./types";

// What the advice rules look at (spec §6.5), gathered in a few SQL queries,
// all scoped by the seller. Owner only (money); the caller checks the role.
//
// Scope "period" (a finished period's report) skips what is about today, not
// the period: stale unpaid orders, stock, this month's links, recent weekdays.
// Those facts come back empty, so their rules stay quiet.

const DAY_MS = 24 * 60 * 60 * 1000;
const saleStatusSql = Prisma.join(SALE_STATUSES.map((s) => Prisma.sql`${s}::"OrderStatus"`));
const isSale = Prisma.sql`o."status" IN (${saleStatusSql})`;

export async function loadInsightFacts(
  sellerId: string,
  range: FinanceRange,
  totals: { current: FinanceTotals; previous: FinanceTotals },
  now = new Date(),
  scope: "all" | "period" = "all",
): Promise<InsightFacts> {
  const today = <T>(load: () => Promise<T>, none: T): Promise<T> => (scope === "all" ? load() : Promise.resolve(none));
  const inPeriod = Prisma.sql`(o."createdAt" >= ${range.from} AND o."createdAt" < ${range.to})`;
  const inPrevious = Prisma.sql`(o."createdAt" >= ${range.previous.from} AND o."createdAt" < ${range.previous.to})`;
  const days = dayKeys(range.from, range.to);
  const since30 = new Date(now.getTime() - 30 * DAY_MS);
  const weeksTo = tehranMidnight(now);
  const weeksFrom = new Date(weeksTo.getTime() - 56 * DAY_MS);

  const [products, [ads], [unpaid], stock, funnel, [customers], weekdays, [first]] = await Promise.all([
    prisma.$queryRaw<
      { productId: string; name: string; sales: bigint; units: bigint; costed: bigint; cogs: bigint; previous: bigint; returned: bigint }[]
    >`
      SELECT p."id" AS "productId", p."name",
             COALESCE(SUM(i."quantity" * i."unitPrice") FILTER (WHERE ${inPeriod} AND ${isSale}), 0) AS sales,
             COALESCE(SUM(i."quantity") FILTER (WHERE ${inPeriod} AND ${isSale}), 0) AS units,
             COALESCE(SUM(i."quantity" * i."unitPrice") FILTER (WHERE ${inPeriod} AND ${isSale} AND i."unitCost" IS NOT NULL), 0) AS costed,
             COALESCE(SUM(i."quantity" * i."unitCost") FILTER (WHERE ${inPeriod} AND ${isSale} AND i."unitCost" IS NOT NULL), 0) AS cogs,
             COALESCE(SUM(i."quantity" * i."unitPrice") FILTER (WHERE ${inPrevious} AND ${isSale}), 0) AS previous,
             COALESCE(SUM(i."quantity") FILTER (WHERE ${inPeriod} AND o."status" = 'RETURNED'), 0) AS returned
      FROM "OrderItem" i
      JOIN "Order" o ON o."id" = i."orderId"
      JOIN "Product" p ON p."id" = i."productId"
      WHERE o."sellerId" = ${sellerId} AND p."sellerId" = ${sellerId}
        AND (${isSale} OR o."status" = 'RETURNED')
        AND (${inPeriod} OR ${inPrevious})
      GROUP BY p."id", p."name"
      ORDER BY sales DESC, p."name" ASC`,
    prisma.$queryRaw<{ amount: bigint }[]>`
      SELECT COALESCE(SUM(e."amount"), 0) AS amount
      FROM "Expense" e
      WHERE e."sellerId" = ${sellerId} AND e."voidedAt" IS NULL AND e."category" = 'ADS'
        AND e."spentOn" >= ${days.first}::date AND e."spentOn" <= ${days.last}::date`,
    today(
      () => prisma.$queryRaw<{ orders: bigint; amount: bigint; with_receipt: bigint }[]>`
      SELECT COUNT(*) AS orders,
             COALESCE(SUM(o."totalPrice" + COALESCE(o."shippingCost", 0)), 0) AS amount,
             COUNT(*) FILTER (WHERE o."receiptImageUrl" IS NOT NULL) AS with_receipt
      FROM "Order" o
      WHERE o."sellerId" = ${sellerId} AND o."status" = 'PENDING_PAYMENT'
        AND o."createdAt" < ${new Date(now.getTime() - 2 * DAY_MS)}`,
      [{ orders: BigInt(0), amount: BigInt(0), with_receipt: BigInt(0) }],
    ),
    // Each variant of the five products that sold the most units in 30 days.
    today(
      () => prisma.$queryRaw<
        { variantId: string; productId: string; name: string; color: string | null; size: string | null; stock: number; units: bigint; product_units: bigint }[]
      >`
      WITH sold AS (
        SELECT i."productId", i."productVariantId", i."quantity"
        FROM "OrderItem" i JOIN "Order" o ON o."id" = i."orderId"
        WHERE o."sellerId" = ${sellerId} AND ${isSale} AND o."createdAt" >= ${since30}
      ), top AS (
        SELECT s."productId", SUM(s."quantity") AS units
        FROM sold s JOIN "Product" p ON p."id" = s."productId"
        WHERE p."sellerId" = ${sellerId} AND p."isActive"
        GROUP BY s."productId"
        ORDER BY units DESC, s."productId"
        LIMIT 5
      )
      SELECT v."id" AS "variantId", p."id" AS "productId", p."name", v."color", v."size", v."stock",
             COALESCE((SELECT SUM(s."quantity") FROM sold s WHERE s."productVariantId" = v."id"), 0) AS units,
             top.units AS product_units
      FROM top
      JOIN "Product" p ON p."id" = top."productId"
      JOIN "ProductVariant" v ON v."productId" = p."id" AND v."sellerId" = ${sellerId}`,
      [],
    ),
    today(() => getLinkFunnel(sellerId, now), null),
    // Buyers in the period; "returning" if their first sale was before it.
    prisma.$queryRaw<{ buyers: bigint; returning: bigint; returning_sales: bigint }[]>`
      SELECT COUNT(*) AS buyers,
             COUNT(*) FILTER (WHERE b.first_sale < ${range.from}) AS returning,
             COALESCE(SUM(b.period_sales) FILTER (WHERE b.first_sale < ${range.from}), 0) AS returning_sales
      FROM (
        SELECT o."customerId",
               MIN(o."createdAt") AS first_sale,
               SUM(o."totalPrice") FILTER (WHERE ${inPeriod}) AS period_sales
        FROM "Order" o
        WHERE o."sellerId" = ${sellerId} AND ${isSale} AND o."createdAt" < ${range.to}
        GROUP BY o."customerId"
        HAVING COUNT(*) FILTER (WHERE ${inPeriod}) > 0
      ) b`,
    today(
      () => prisma.$queryRaw<{ dow: number; sales: bigint; orders: bigint }[]>`
      SELECT EXTRACT(DOW FROM (o."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${APP_TIME_ZONE}))::int AS dow,
             SUM(o."totalPrice") AS sales,
             COUNT(*) AS orders
      FROM "Order" o
      WHERE o."sellerId" = ${sellerId} AND ${isSale}
        AND o."createdAt" >= ${weeksFrom} AND o."createdAt" < ${weeksTo}
      GROUP BY 1`,
      [],
    ),
    today(
      () => prisma.$queryRaw<{ first: Date | null }[]>`
      SELECT MIN(o."createdAt") AS first FROM "Order" o WHERE o."sellerId" = ${sellerId} AND ${isSale}`,
      [{ first: null }],
    ),
  ]);

  // Postgres counts weekdays from Sunday (0); the Iranian week starts on Saturday.
  const weekdaySales = Array.from({ length: 7 }, () => 0);
  for (const row of weekdays) weekdaySales[(row.dow + 1) % 7] = Number(row.sales);

  return {
    label: range.label,
    compareLabel: range.compareLabel,
    current: totals.current,
    previous: totals.previous,
    products: products.map((p) => ({
      productId: p.productId,
      name: p.name,
      sales: Number(p.sales),
      units: Number(p.units),
      costedSales: Number(p.costed),
      cogs: Number(p.cogs),
      previousSales: Number(p.previous),
      returnedUnits: Number(p.returned),
    })),
    adsExpenses: Number(ads.amount),
    staleUnpaid: { orders: Number(unpaid.orders), amount: Number(unpaid.amount), withReceipt: Number(unpaid.with_receipt) },
    stock: stock.map((s) => ({
      variantId: s.variantId,
      productId: s.productId,
      name: s.name,
      color: s.color,
      size: s.size,
      stock: s.stock,
      units30: Number(s.units),
      productUnits30: Number(s.product_units),
    })),
    links: (funnel?.links ?? []).filter((l) => l.isActive).map((l) => ({ linkId: l.linkId, title: l.title, views: l.views, paid: l.paid })),
    customers: {
      buyers: Number(customers.buyers),
      returningBuyers: Number(customers.returning),
      returningSales: Number(customers.returning_sales),
    },
    weekdays: {
      sales: weekdaySales,
      orders: weekdays.reduce((s, r) => s + Number(r.orders), 0),
      daysSinceFirstSale: first.first ? Math.floor((now.getTime() - first.first.getTime()) / DAY_MS) : null,
    },
  };
}
