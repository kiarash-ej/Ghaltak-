import "server-only";
import type { CustomerTag, Prisma } from "@/generated/prisma/client";
import { toEnglishDigits } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { CUSTOMER_TAGS, computeStats, type CustomerStats } from "./stats";

// Every function takes the sellerId from requireSeller() and scopes by it.
// Orders are Track B's data; they are only read here.

export const PAGE_SIZE = 20;
export const PROFILE_ORDER_LIMIT = 100;

export type CustomerListItem = {
  id: string;
  name: string | null;
  phone: string;
  tag: CustomerTag;
  stats: CustomerStats;
};

export async function listCustomers(
  sellerId: string,
  opts: { q?: string; tag?: CustomerTag; page?: number },
) {
  const q = opts.q?.trim();
  const digits = q ? toEnglishDigits(q).replace(/\D/g, "") : "";
  const where: Prisma.CustomerWhereInput = {
    sellerId,
    ...(opts.tag ? { tag: opts.tag } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
          ],
        }
      : {}),
  };

  const total = await prisma.customer.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, opts.page ?? 1), pageCount);

  const customers = await prisma.customer.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: { id: true, name: true, phone: true, tag: true },
  });

  const orders = await prisma.order.findMany({
    where: { sellerId, customerId: { in: customers.map((c) => c.id) } },
    select: { customerId: true, status: true, totalPrice: true, createdAt: true },
  });
  const byCustomer = Map.groupBy(orders, (o) => o.customerId);

  const items: CustomerListItem[] = customers.map((c) => ({
    ...c,
    stats: computeStats(byCustomer.get(c.id) ?? []),
  }));
  return { items, total, page, pageCount };
}

/** Number of customers per tag, for the filter tabs. */
export async function countByTag(sellerId: string) {
  const rows = await prisma.customer.groupBy({
    by: ["tag"],
    where: { sellerId },
    _count: { _all: true },
  });
  const counts = Object.fromEntries(CUSTOMER_TAGS.map((t) => [t, 0])) as Record<CustomerTag, number>;
  for (const r of rows) counts[r.tag] = r._count._all;
  return { ...counts, total: rows.reduce((a, r) => a + r._count._all, 0) };
}

export async function getCustomerProfile(sellerId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, sellerId },
    select: { id: true, name: true, phone: true, address: true, tag: true, createdAt: true },
  });
  if (!customer) return null;

  const orders = await prisma.order.findMany({
    where: { sellerId, customerId: customer.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      status: true,
      source: true,
      totalPrice: true,
      createdAt: true,
      _count: { select: { items: true } },
    },
  });

  return {
    customer,
    stats: computeStats(orders),
    orders: orders.slice(0, PROFILE_ORDER_LIMIT),
    totalOrders: orders.length,
  };
}
