import "server-only";
import { prisma } from "@/lib/prisma";
import { DEFAULT_STORE_NAME } from "@/server/account";
import { inventorySummary } from "@/server/catalog/inventory-queries";
import { countPendingReceipts } from "@/server/orders/queries";
import { hasSavedCard } from "@/server/payments/card-store";
import { reportPeriods } from "@/server/reports/periods";
import { salesSince, type SalesSummary } from "@/server/reports/queries";
import type { OnboardingFacts } from "./onboarding";

// Data for the dashboard home (Phase 2, C5). Read-only, and every query is
// scoped by the sellerId from requireSeller().
//
// The numbers reuse the owning track's definitions instead of restating them:
// "sale" is B5's (salesSince), "receipt waiting" is B3's (countPendingReceipts)
// and "needs restock" is Track A's, active products only (#19, inventorySummary).

export async function getOnboardingFacts(sellerId: string): Promise<OnboardingFacts> {
  const [seller, product, card, link, order] = await Promise.all([
    prisma.seller.findUnique({
      where: { id: sellerId },
      select: { name: true, contactPhone: true, instagram: true, telegram: true },
    }),
    prisma.product.findFirst({ where: { sellerId }, select: { id: true } }),
    hasSavedCard(sellerId),
    prisma.purchaseLink.findFirst({ where: { sellerId }, select: { id: true } }),
    prisma.order.findFirst({ where: { sellerId }, select: { id: true } }),
  ]);
  return {
    storeComplete: Boolean(
      seller &&
        seller.name !== DEFAULT_STORE_NAME &&
        (seller.contactPhone || seller.instagram || seller.telegram),
    ),
    hasProduct: product !== null,
    hasCard: card,
    hasPurchaseLink: link !== null,
    hasOrder: order !== null,
  };
}

export type TodaySummary = {
  /** Every order placed today (Tehran day), whatever its status, as in the orders list. */
  ordersToday: number;
  /** Today's sales by B5's definition (paid, not canceled or returned). */
  salesToday: SalesSummary;
  pendingReceipts: number;
  needsRestock: number;
};

export async function getTodaySummary(sellerId: string, now = new Date()): Promise<TodaySummary> {
  const { today } = reportPeriods(now);
  const [ordersToday, salesToday, pendingReceipts, inventory] = await Promise.all([
    prisma.order.count({ where: { sellerId, createdAt: { gte: today } } }),
    salesSince(sellerId, today),
    countPendingReceipts(sellerId),
    inventorySummary(sellerId),
  ]);
  return { ordersToday, salesToday, pendingReceipts, needsRestock: inventory.low };
}
