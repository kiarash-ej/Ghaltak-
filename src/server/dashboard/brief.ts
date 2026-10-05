import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { APP_TIME_ZONE } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { lastDays, tehranDateKey, tehranMidnight } from "@/server/reports/periods";
import { SALE_STATUSES } from "@/server/reports/queries";

// Yesterday at a glance, for the daily brief on Home (spec §7.1). "Sale" is
// B5's definition; days are Tehran days; scoped by the seller.

const DAY_MS = 24 * 60 * 60 * 1000;
const saleStatusSql = Prisma.join(SALE_STATUSES.map((s) => Prisma.sql`${s}::"OrderStatus"`));
const tehranDay = Prisma.sql`(o."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${APP_TIME_ZONE})::date`;
const weekdayName = new Intl.DateTimeFormat("fa-IR", { timeZone: APP_TIME_ZONE, weekday: "long" });

export type DailyBrief = {
  /** Today's Tehran day; the brief's dismissal is remembered for this day. */
  dayKey: string;
  /** e.g. «دوشنبه». */
  yesterdayWeekday: string;
  /** Yesterday's sales in tomans, and every order placed yesterday. */
  sales: number;
  orders: number;
  /** Sales on the same weekday a week before yesterday. */
  lastWeekSales: number;
  /** The 7 days ending yesterday, oldest first. */
  week: { key: string; total: number }[];
  /** Whether the store has ever made a sale (no brief before the first one). */
  hasSales: boolean;
};

export async function getDailyBrief(sellerId: string, now = new Date()): Promise<DailyBrief> {
  const today = tehranMidnight(now);
  const yesterdayNoon = new Date(today.getTime() - DAY_MS / 2);
  // 8 days: the week ending yesterday, plus the same weekday a week earlier.
  const days = lastDays(yesterdayNoon, 8);
  const from = days[0].start;

  const [rows, anySale] = await Promise.all([
    prisma.$queryRaw<{ day: string; sales: bigint; orders: bigint }[]>`
      SELECT to_char(${tehranDay}, 'YYYY-MM-DD') AS day,
             COALESCE(SUM(o."totalPrice") FILTER (WHERE o."status" IN (${saleStatusSql})), 0) AS sales,
             COUNT(*) AS orders
      FROM "Order" o
      WHERE o."sellerId" = ${sellerId} AND o."createdAt" >= ${from} AND o."createdAt" < ${today}
      GROUP BY 1`,
    prisma.order.findFirst({ where: { sellerId, status: { in: [...SALE_STATUSES] } }, select: { id: true } }),
  ]);
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const totals = days.map((d) => ({ key: d.key, total: Number(byDay.get(d.key)?.sales ?? 0) }));
  const yesterday = days[days.length - 1];

  return {
    dayKey: tehranDateKey(now),
    yesterdayWeekday: weekdayName.format(yesterdayNoon),
    sales: totals[totals.length - 1].total,
    orders: Number(byDay.get(yesterday.key)?.orders ?? 0),
    lastWeekSales: totals[0].total,
    week: totals.slice(1),
    hasSales: anySale !== null,
  };
}
