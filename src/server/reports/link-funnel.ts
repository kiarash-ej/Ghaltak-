import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { reportPeriods, tehranDateKey } from "./periods";
import { SALE_STATUSES } from "./queries";

// Purchase-link funnel (B8), for this Jalali month: how many times each link
// was opened, how many orders it brought, and how many of those were paid.
// Aggregated in SQL and scoped by the seller, like the rest of the report.
//
// Definitions (also shown on the pages):
// - Views: openings of /buy/[token] by people, counted per Tehran day
//   (link previews, bots and prefetches are not counted; see link-view-filter.ts).
// - Orders: every order placed through the link this month, whatever its status.
// - Paid: the same definition as a "sale" in the sales report (SALE_STATUSES).
// - Conversion: paid ÷ views. No rate without views.

export type FunnelCounts = { views: number; orders: number; paid: number; conversion: number | null };

export type LinkFunnelRow = FunnelCounts & {
  linkId: string;
  title: string | null;
  isActive: boolean;
};

export type LinkFunnel = {
  /** Start of this month (Tehran midnight on the 1st). */
  since: Date;
  /** Every link of the seller, busiest first. */
  links: LinkFunnelRow[];
  total: FunnelCounts;
};

const saleStatusSql = Prisma.join(SALE_STATUSES.map((s) => Prisma.sql`${s}::"OrderStatus"`));

function conversion(paid: number, views: number): number | null {
  return views > 0 ? paid / views : null;
}

export async function getLinkFunnel(sellerId: string, now = new Date()): Promise<LinkFunnel> {
  const since = reportPeriods(now).month;
  // The month's first Tehran day, as LinkDailyView.day stores it (noon avoids the boundary).
  const firstDay = tehranDateKey(new Date(since.getTime() + 12 * 60 * 60 * 1000));

  const rows = await prisma.$queryRaw<
    { linkId: string; title: string | null; isActive: boolean; views: bigint; orders: bigint; paid: bigint }[]
  >`
    SELECT l."id" AS "linkId", l."title", l."isActive",
           COALESCE(v.views, 0) AS views,
           COALESCE(o.orders, 0) AS orders,
           COALESCE(o.paid, 0) AS paid
    FROM "PurchaseLink" l
    LEFT JOIN (
      SELECT d."purchaseLinkId", SUM(d."views") AS views
      FROM "LinkDailyView" d
      JOIN "PurchaseLink" dl ON dl."id" = d."purchaseLinkId"
      WHERE dl."sellerId" = ${sellerId} AND d."day" >= ${firstDay}::date
      GROUP BY d."purchaseLinkId"
    ) v ON v."purchaseLinkId" = l."id"
    LEFT JOIN (
      SELECT o."purchaseLinkId",
             COUNT(*) AS orders,
             COUNT(*) FILTER (WHERE o."status" IN (${saleStatusSql})) AS paid
      FROM "Order" o
      WHERE o."sellerId" = ${sellerId} AND o."purchaseLinkId" IS NOT NULL AND o."createdAt" >= ${since}
      GROUP BY o."purchaseLinkId"
    ) o ON o."purchaseLinkId" = l."id"
    WHERE l."sellerId" = ${sellerId}
    ORDER BY views DESC, orders DESC, l."createdAt" DESC`;

  const links = rows.map((r) => {
    const views = Number(r.views);
    const paid = Number(r.paid);
    return {
      linkId: r.linkId,
      title: r.title,
      isActive: r.isActive,
      views,
      orders: Number(r.orders),
      paid,
      conversion: conversion(paid, views),
    };
  });

  const views = links.reduce((s, l) => s + l.views, 0);
  const paid = links.reduce((s, l) => s + l.paid, 0);
  return {
    since,
    links,
    total: { views, orders: links.reduce((s, l) => s + l.orders, 0), paid, conversion: conversion(paid, views) },
  };
}
