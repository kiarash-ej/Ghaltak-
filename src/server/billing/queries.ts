import "server-only";
import { prisma } from "@/lib/prisma";

/** The store's invoices for /settings/billing, newest first. Abandoned (VOID) ones are left out. */
export function listInvoices(sellerId: string) {
  return prisma.invoice.findMany({
    where: { sellerId, status: { not: "VOID" } },
    orderBy: { createdAt: "desc" },
    take: 24,
    select: { id: true, plan: true, amount: true, status: true, periodStart: true, periodEnd: true, paidAt: true, createdAt: true },
  });
}
