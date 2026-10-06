import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { APP_TIME_ZONE } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { tehranDateKey } from "@/server/reports/periods";
import { SALE_STATUSES } from "@/server/reports/queries";

// The finance numbers (spec §6.2). Aggregated in SQL, scoped by the seller,
// on Tehran days. Owner only: callers check the role (A10).
//
// - Sales: orders in SALE_STATUSES (B5), Order.totalPrice (items, no
//   shipping), by the Tehran day the order was placed.
// - Cost of goods: Σ unitCost × quantity over those orders' lines that have a
//   cost. Coverage: the share of sales whose lines have a cost. Missing costs
//   are never guessed; the page says "based on X% of sales".
// - Expenses: non-voided Expense rows dated in the period.
// - Net profit = sales − cost of goods − expenses; margin = net ÷ sales.

const DAY_MS = 24 * 60 * 60 * 1000;
const saleStatusSql = Prisma.join(SALE_STATUSES.map((s) => Prisma.sql`${s}::"OrderStatus"`));
const orderDay = Prisma.sql`to_char((o."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${APP_TIME_ZONE})::date, 'YYYY-MM-DD')`;

/** The Tehran days of [from, to) as date keys, first and last inclusive. */
function dayKeys(from: Date, to: Date) {
  return { first: tehranDateKey(from), last: tehranDateKey(new Date(to.getTime() - 1)) };
}

export type FinanceTotals = {
  sales: number;
  saleOrders: number;
  cogs: number;
  /** Share of sales whose lines have a cost; null without sales. */
  coverage: number | null;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  /** Net profit ÷ sales; null without sales. */
  margin: number | null;
  averageOrder: number | null;
  ordersPlaced: number;
  /** Returned ÷ (sales + returned); null when neither happened. */
  returnRate: number | null;
  /** Canceled ÷ every order placed; null without orders. */
  cancelRate: number | null;
};

export async function getFinanceTotals(sellerId: string, from: Date, to: Date): Promise<FinanceTotals> {
  const days = dayKeys(from, to);
  const [[orders], [items], [exp]] = await Promise.all([
    prisma.$queryRaw<{ sales: bigint; sale_orders: bigint; placed: bigint; returned: bigint; canceled: bigint }[]>`
      SELECT COALESCE(SUM(o."totalPrice") FILTER (WHERE o."status" IN (${saleStatusSql})), 0) AS sales,
             COUNT(*) FILTER (WHERE o."status" IN (${saleStatusSql})) AS sale_orders,
             COUNT(*) AS placed,
             COUNT(*) FILTER (WHERE o."status" = 'RETURNED') AS returned,
             COUNT(*) FILTER (WHERE o."status" = 'CANCELED') AS canceled
      FROM "Order" o
      WHERE o."sellerId" = ${sellerId} AND o."createdAt" >= ${from} AND o."createdAt" < ${to}`,
    prisma.$queryRaw<{ item_sales: bigint; covered: bigint; cogs: bigint }[]>`
      SELECT COALESCE(SUM(i."quantity" * i."unitPrice"), 0) AS item_sales,
             COALESCE(SUM(i."quantity" * i."unitPrice") FILTER (WHERE i."unitCost" IS NOT NULL), 0) AS covered,
             COALESCE(SUM(i."quantity" * i."unitCost") FILTER (WHERE i."unitCost" IS NOT NULL), 0) AS cogs
      FROM "OrderItem" i JOIN "Order" o ON o."id" = i."orderId"
      WHERE o."sellerId" = ${sellerId} AND o."status" IN (${saleStatusSql})
        AND o."createdAt" >= ${from} AND o."createdAt" < ${to}`,
    prisma.$queryRaw<{ expenses: bigint }[]>`
      SELECT COALESCE(SUM(e."amount"), 0) AS expenses
      FROM "Expense" e
      WHERE e."sellerId" = ${sellerId} AND e."voidedAt" IS NULL
        AND e."spentOn" >= ${days.first}::date AND e."spentOn" <= ${days.last}::date`,
  ]);

  const sales = Number(orders.sales);
  const saleOrders = Number(orders.sale_orders);
  const placed = Number(orders.placed);
  const returned = Number(orders.returned);
  const itemSales = Number(items.item_sales);
  const cogs = Number(items.cogs);
  const expenses = Number(exp.expenses);
  const grossProfit = sales - cogs;
  const netProfit = grossProfit - expenses;
  return {
    sales,
    saleOrders,
    cogs,
    coverage: itemSales > 0 ? Number(items.covered) / itemSales : null,
    grossProfit,
    expenses,
    netProfit,
    margin: sales > 0 ? netProfit / sales : null,
    averageOrder: saleOrders > 0 ? Math.round(sales / saleOrders) : null,
    ordersPlaced: placed,
    returnRate: saleOrders + returned > 0 ? returned / (saleOrders + returned) : null,
    cancelRate: placed > 0 ? Number(orders.canceled) / placed : null,
  };
}

export type FinancePoint = { key: string; sales: number; net: number };

/** Sales and net profit for each Tehran day of [from, to), oldest first. */
export async function getFinanceSeries(sellerId: string, from: Date, to: Date): Promise<FinancePoint[]> {
  const days = dayKeys(from, to);
  const [sales, cogs, expenses] = await Promise.all([
    prisma.$queryRaw<{ day: string; v: bigint }[]>`
      SELECT ${orderDay} AS day, SUM(o."totalPrice") AS v
      FROM "Order" o
      WHERE o."sellerId" = ${sellerId} AND o."status" IN (${saleStatusSql})
        AND o."createdAt" >= ${from} AND o."createdAt" < ${to}
      GROUP BY 1`,
    prisma.$queryRaw<{ day: string; v: bigint }[]>`
      SELECT ${orderDay} AS day, SUM(i."quantity" * i."unitCost") AS v
      FROM "OrderItem" i JOIN "Order" o ON o."id" = i."orderId"
      WHERE o."sellerId" = ${sellerId} AND o."status" IN (${saleStatusSql}) AND i."unitCost" IS NOT NULL
        AND o."createdAt" >= ${from} AND o."createdAt" < ${to}
      GROUP BY 1`,
    prisma.$queryRaw<{ day: string; v: bigint }[]>`
      SELECT to_char(e."spentOn", 'YYYY-MM-DD') AS day, SUM(e."amount") AS v
      FROM "Expense" e
      WHERE e."sellerId" = ${sellerId} AND e."voidedAt" IS NULL
        AND e."spentOn" >= ${days.first}::date AND e."spentOn" <= ${days.last}::date
      GROUP BY 1`,
  ]);
  const map = (rows: { day: string; v: bigint }[]) => new Map(rows.map((r) => [r.day, Number(r.v)]));
  const s = map(sales);
  const c = map(cogs);
  const e = map(expenses);

  const points: FinancePoint[] = [];
  // Noon of each Tehran day, so the key is right whatever the offset.
  for (let t = from.getTime() + DAY_MS / 2; t < to.getTime(); t += DAY_MS) {
    const key = tehranDateKey(new Date(t));
    const daySales = s.get(key) ?? 0;
    points.push({ key, sales: daySales, net: daySales - (c.get(key) ?? 0) - (e.get(key) ?? 0) });
  }
  return points;
}

/** Orders still waiting for payment, with what they owe (items + shipping). Not tied to a period. */
export async function getUnpaid(sellerId: string): Promise<{ orders: number; amount: number }> {
  const [row] = await prisma.$queryRaw<{ orders: bigint; amount: bigint }[]>`
    SELECT COUNT(*) AS orders, COALESCE(SUM(o."totalPrice" + COALESCE(o."shippingCost", 0)), 0) AS amount
    FROM "Order" o
    WHERE o."sellerId" = ${sellerId} AND o."status" = 'PENDING_PAYMENT'`;
  return { orders: Number(row.orders), amount: Number(row.amount) };
}
