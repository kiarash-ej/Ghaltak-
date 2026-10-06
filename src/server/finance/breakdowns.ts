import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { OrderSource, PaymentMethod } from "@/generated/prisma/enums";
import { APP_TIME_ZONE } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { SALE_STATUSES } from "@/server/reports/queries";

// The «فروش» and «سود محصولات» tabs (spec §6.4). All in SQL, scoped by the
// seller, sales by the definition in §6.2 (B5) on Tehran days. Amounts are
// the owner's; the Sales tab shows operators the counts only (A10).

const saleStatusSql = Prisma.join(SALE_STATUSES.map((s) => Prisma.sql`${s}::"OrderStatus"`));
const isSale = Prisma.sql`o."status" IN (${saleStatusSql})`;
const tehranDay = Prisma.sql`(o."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${APP_TIME_ZONE})::date`;

export type DaySales = { key: string; sales: number; orders: number };

/** Sales and sale orders per Tehran day that had any (the chart fills the gaps). */
export async function getDailySales(sellerId: string, from: Date, to: Date): Promise<DaySales[]> {
  const rows = await prisma.$queryRaw<{ day: string; sales: bigint; orders: bigint }[]>`
    SELECT to_char(${tehranDay}, 'YYYY-MM-DD') AS day, SUM(o."totalPrice") AS sales, COUNT(*) AS orders
    FROM "Order" o
    WHERE o."sellerId" = ${sellerId} AND ${isSale} AND o."createdAt" >= ${from} AND o."createdAt" < ${to}
    GROUP BY 1 ORDER BY 1`;
  return rows.map((r) => ({ key: r.day, sales: Number(r.sales), orders: Number(r.orders) }));
}

export type Split<K> = { key: K; orders: number; sales: number };

export type SalesBreakdown = {
  /** Saturday first. */
  byWeekday: { orders: number; sales: number }[];
  payment: Split<PaymentMethod | null>[];
  source: Split<OrderSource>[];
  topCustomers: { customerId: string; name: string | null; phone: string; orders: number; sales: number }[];
  topProducts: { productId: string; name: string; units: number; sales: number }[];
  units: number;
};

export async function getSalesBreakdown(sellerId: string, from: Date, to: Date, rankBy: "sales" | "units"): Promise<SalesBreakdown> {
  const inRange = Prisma.sql`o."sellerId" = ${sellerId} AND ${isSale} AND o."createdAt" >= ${from} AND o."createdAt" < ${to}`;
  const productOrder = rankBy === "sales" ? Prisma.sql`sales DESC, units DESC` : Prisma.sql`units DESC, sales DESC`;
  const [weekdays, payment, source, customers, products, [units]] = await Promise.all([
    prisma.$queryRaw<{ dow: number; orders: bigint; sales: bigint }[]>`
      SELECT EXTRACT(DOW FROM ${tehranDay})::int AS dow, COUNT(*) AS orders, SUM(o."totalPrice") AS sales
      FROM "Order" o WHERE ${inRange} GROUP BY 1`,
    prisma.$queryRaw<{ key: PaymentMethod | null; orders: bigint; sales: bigint }[]>`
      SELECT o."paymentMethod" AS key, COUNT(*) AS orders, SUM(o."totalPrice") AS sales
      FROM "Order" o WHERE ${inRange} GROUP BY 1 ORDER BY sales DESC`,
    prisma.$queryRaw<{ key: OrderSource; orders: bigint; sales: bigint }[]>`
      SELECT o."source" AS key, COUNT(*) AS orders, SUM(o."totalPrice") AS sales
      FROM "Order" o WHERE ${inRange} GROUP BY 1 ORDER BY sales DESC`,
    prisma.$queryRaw<{ customerId: string; name: string | null; phone: string; orders: bigint; sales: bigint }[]>`
      SELECT c."id" AS "customerId", c."name", c."phone", COUNT(*) AS orders, SUM(o."totalPrice") AS sales
      FROM "Order" o JOIN "Customer" c ON c."id" = o."customerId" AND c."sellerId" = ${sellerId}
      WHERE ${inRange}
      GROUP BY c."id", c."name", c."phone"
      ORDER BY sales DESC, orders DESC, c."id"
      LIMIT 5`,
    prisma.$queryRaw<{ productId: string; name: string; units: bigint; sales: bigint }[]>`
      SELECT p."id" AS "productId", p."name", SUM(i."quantity") AS units, SUM(i."quantity" * i."unitPrice") AS sales
      FROM "OrderItem" i JOIN "Order" o ON o."id" = i."orderId" JOIN "Product" p ON p."id" = i."productId" AND p."sellerId" = ${sellerId}
      WHERE ${inRange}
      GROUP BY p."id", p."name"
      ORDER BY ${productOrder}, p."name"
      LIMIT 10`,
    prisma.$queryRaw<{ units: bigint }[]>`
      SELECT COALESCE(SUM(i."quantity"), 0) AS units
      FROM "OrderItem" i JOIN "Order" o ON o."id" = i."orderId"
      WHERE ${inRange}`,
  ]);

  const byWeekday = Array.from({ length: 7 }, () => ({ orders: 0, sales: 0 }));
  // Postgres counts from Sunday (0); the Iranian week starts on Saturday.
  for (const w of weekdays) byWeekday[(w.dow + 1) % 7] = { orders: Number(w.orders), sales: Number(w.sales) };
  const split = <K>(rows: { key: K; orders: bigint; sales: bigint }[]) => rows.map((r) => ({ key: r.key, orders: Number(r.orders), sales: Number(r.sales) }));
  return {
    byWeekday,
    payment: split(payment),
    source: split(source),
    topCustomers: customers.map((c) => ({ ...c, orders: Number(c.orders), sales: Number(c.sales) })),
    topProducts: products.map((p) => ({ productId: p.productId, name: p.name, units: Number(p.units), sales: Number(p.sales) })),
    units: Number(units.units),
  };
}

export type ProductProfitRow = {
  productId: string;
  name: string;
  /** The product's cost price now (what the inline field starts from). */
  costPrice: number | null;
  units: number;
  sales: number;
  cogs: number;
  /** Sales of the lines that have a cost; profit and margin are over these only. */
  costedSales: number;
  /** Units sold without a cost: these sales' profit is unknown. */
  uncostedUnits: number;
  grossProfit: number | null;
  margin: number | null;
};

/** Every product sold in the period: units, sales, cost of goods, gross profit, margin. */
export async function getProductProfit(sellerId: string, from: Date, to: Date): Promise<ProductProfitRow[]> {
  const rows = await prisma.$queryRaw<
    { productId: string; name: string; costPrice: number | null; units: bigint; sales: bigint; costed: bigint; cogs: bigint; uncosted: bigint }[]
  >`
    SELECT p."id" AS "productId", p."name", p."costPrice",
           SUM(i."quantity") AS units,
           SUM(i."quantity" * i."unitPrice") AS sales,
           COALESCE(SUM(i."quantity" * i."unitPrice") FILTER (WHERE i."unitCost" IS NOT NULL), 0) AS costed,
           COALESCE(SUM(i."quantity" * i."unitCost") FILTER (WHERE i."unitCost" IS NOT NULL), 0) AS cogs,
           COALESCE(SUM(i."quantity") FILTER (WHERE i."unitCost" IS NULL), 0) AS uncosted
    FROM "OrderItem" i JOIN "Order" o ON o."id" = i."orderId" JOIN "Product" p ON p."id" = i."productId"
    WHERE o."sellerId" = ${sellerId} AND p."sellerId" = ${sellerId} AND ${isSale}
      AND o."createdAt" >= ${from} AND o."createdAt" < ${to}
    GROUP BY p."id", p."name", p."costPrice"
    ORDER BY sales DESC, p."name"`;
  return rows.map((r) => {
    const costed = Number(r.costed);
    const cogs = Number(r.cogs);
    const grossProfit = costed > 0 ? costed - cogs : null;
    return {
      productId: r.productId,
      name: r.name,
      costPrice: r.costPrice,
      units: Number(r.units),
      sales: Number(r.sales),
      cogs,
      costedSales: costed,
      uncostedUnits: Number(r.uncosted),
      grossProfit,
      margin: grossProfit !== null ? grossProfit / costed : null,
    };
  });
}
