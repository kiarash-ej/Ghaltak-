import "server-only";
import { prisma } from "@/lib/prisma";
import { TAG_LABELS, computeStats } from "@/server/customers/stats";
import { formatPhone, type CsvValue } from "./csv";
import { formatJalaliDate } from "./jalali";

// Customers with purchase stats (C6). The stats come from Track A's
// computeStats, the same numbers as the customer's profile page: a purchase is
// a paid order that wasn't canceled or returned.

export const CUSTOMER_HEADER = [
  "نام",
  "موبایل",
  "آدرس",
  "برچسب",
  "تاریخ ثبت",
  "تعداد سفارش",
  "تعداد خرید",
  "جمع خرید (تومان)",
  "میانگین خرید (تومان)",
  "آخرین خرید",
  "تعداد مرجوعی",
];

export async function* customerRows(sellerId: string, opts: { batchSize?: number } = {}): AsyncGenerator<CsvValue[][]> {
  const take = opts.batchSize ?? 500;
  let cursor: string | undefined;
  for (;;) {
    const customers = await prisma.customer.findMany({
      where: { sellerId },
      orderBy: { id: "asc" },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, name: true, phone: true, address: true, tag: true, createdAt: true },
    });
    if (customers.length === 0) return;
    cursor = customers[customers.length - 1].id;

    const orders = await prisma.order.findMany({
      where: { sellerId, customerId: { in: customers.map((c) => c.id) } },
      select: { customerId: true, status: true, totalPrice: true, createdAt: true },
    });
    const byCustomer = Map.groupBy(orders, (o) => o.customerId);

    yield customers.map((c) => {
      const s = computeStats(byCustomer.get(c.id) ?? []);
      return [
        c.name,
        formatPhone(c.phone),
        c.address,
        TAG_LABELS[c.tag],
        formatJalaliDate(c.createdAt),
        s.orderCount,
        s.purchaseCount,
        s.totalSpent,
        s.averageOrder,
        s.lastPurchaseAt ? formatJalaliDate(s.lastPurchaseAt) : null,
        s.returnCount,
      ];
    });
    if (customers.length < take) return;
  }
}
