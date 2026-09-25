import "server-only";
import type { OrderStatus, Prisma } from "@/generated/prisma/client";
import { toEnglishDigits } from "@/lib/format";
import { prisma } from "@/lib/prisma";

// Every function takes the sellerId from requireSeller() and scopes by it.

export const PAGE_SIZE = 20;

/** Short human-friendly code shown to sellers and customers, e.g. "K3F9QZ". */
export function orderCode(orderId: string): string {
  return orderId.slice(-6).toUpperCase();
}

export type OrderListItem = {
  id: string;
  code: string;
  customerName: string | null;
  customerPhone: string;
  status: OrderStatus;
  source: "MANUAL" | "PURCHASE_LINK";
  totalPrice: number;
  itemCount: number;
  /** A customer receipt is waiting for the seller to review. */
  receiptPending: boolean;
  /** An online payment arrived that could not be applied to the order (B6): seller must check. */
  onlinePaymentNeedsReview: boolean;
  createdAt: Date;
};

export type OrderListResult = {
  items: OrderListItem[];
  total: number;
  page: number;
  pageCount: number;
};

/**
 * A customer uploaded a card-to-card receipt and the order still awaits
 * payment, so the seller should review it. The list's «رسید دریافت شد» badge
 * and the dashboard's count (Track C, C5) both use this rule.
 */
export function isReceiptPending(o: { status: OrderStatus; receiptImageUrl: string | null }): boolean {
  return o.status === "PENDING_PAYMENT" && o.receiptImageUrl !== null;
}

/** How many of the seller's orders have a receipt waiting for review (same rule as isReceiptPending). */
export async function countPendingReceipts(sellerId: string): Promise<number> {
  return prisma.order.count({
    where: { sellerId, status: "PENDING_PAYMENT", receiptImageUrl: { not: null } },
  });
}

export async function listOrders(
  sellerId: string,
  opts: { status?: OrderStatus; q?: string; page?: number },
): Promise<OrderListResult> {
  const q = opts.q?.trim();
  const phoneDigits = q ? toEnglishDigits(q).replace(/\D/g, "") : "";

  const where: Prisma.OrderWhereInput = {
    sellerId,
    ...(opts.status ? { status: opts.status } : {}),
    ...(q
      ? {
          customer: {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              ...(phoneDigits.length >= 3 ? [{ phone: { contains: phoneDigits } }] : []),
            ],
          },
        }
      : {}),
  };

  const total = await prisma.order.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, opts.page ?? 1), pageCount);

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      status: true,
      source: true,
      totalPrice: true,
      receiptImageUrl: true,
      createdAt: true,
      customer: { select: { name: true, phone: true } },
      _count: {
        select: {
          items: true,
          paymentAttempts: { where: { status: "VERIFIED", failureDetail: { not: null } } },
        },
      },
    },
  });

  return {
    items: orders.map((o) => ({
      id: o.id,
      code: orderCode(o.id),
      customerName: o.customer.name,
      customerPhone: o.customer.phone,
      status: o.status,
      source: o.source,
      totalPrice: o.totalPrice,
      itemCount: o._count.items,
      receiptPending: isReceiptPending(o),
      onlinePaymentNeedsReview: o._count.paymentAttempts > 0,
      createdAt: o.createdAt,
    })),
    total,
    page,
    pageCount,
  };
}

export async function getOrder(sellerId: string, orderId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, sellerId },
    include: {
      customer: { select: { id: true, name: true, phone: true, address: true } },
      items: {
        orderBy: { id: "asc" },
        include: {
          product: { select: { name: true } },
          productVariant: { select: { color: true, size: true, sku: true } },
        },
      },
      // Customer SMS for this order (B7): what was sent and how it went. No texts are stored.
      smsMessages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, kind: true, status: true, attempts: true, createdAt: true },
      },
      // Online payment attempts (B6), newest first. Never the gateway credentials.
      paymentAttempts: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          amount: true,
          status: true,
          failureReason: true,
          failureDetail: true,
          refId: true,
          cardPanMasked: true,
          createdAt: true,
          verifiedAt: true,
        },
      },
    },
  });
}

export type OrderFormCustomer = {
  id: string;
  name: string | null;
  phone: string;
  address: string | null;
};

export type OrderFormVariant = {
  id: string;
  productName: string;
  color: string | null;
  size: string | null;
  price: number;
  stock: number;
};

/** Customers and sellable variants for the manual order form. */
export async function getOrderFormOptions(sellerId: string): Promise<{
  customers: OrderFormCustomer[];
  variants: OrderFormVariant[];
}> {
  const [customers, variants] = await Promise.all([
    prisma.customer.findMany({
      where: { sellerId },
      orderBy: [{ name: "asc" }, { createdAt: "desc" }],
      select: { id: true, name: true, phone: true, address: true },
    }),
    prisma.productVariant.findMany({
      where: { sellerId, product: { isActive: true } },
      orderBy: [{ product: { name: "asc" } }, { id: "asc" }],
      select: {
        id: true,
        color: true,
        size: true,
        stock: true,
        product: { select: { name: true, price: true } },
      },
    }),
  ]);

  return {
    customers,
    variants: variants.map((v) => ({
      id: v.id,
      productName: v.product.name,
      color: v.color,
      size: v.size,
      price: v.product.price,
      stock: v.stock,
    })),
  };
}
