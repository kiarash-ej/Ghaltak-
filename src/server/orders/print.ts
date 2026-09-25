import "server-only";
import type { OrderStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { MAX_PRINT_ORDERS, type PrintSelection } from "./print-request";
import { orderCode } from "./queries";
import { shippingMethodLabel } from "./shipping";

// Shipping sheets (B9): what goes on the parcel. Scoped by the sellerId from
// requireSeller(); ids of other sellers' orders simply match nothing.

/** Paid and not shipped yet: what the seller packs today. */
export const READY_TO_SHIP: readonly OrderStatus[] = ["PAID", "PREPARING"];

export type PrintableOrder = {
  id: string;
  code: string;
  createdAt: Date;
  customerName: string | null;
  customerPhone: string;
  /** The order's shipping address, or the customer's saved one. */
  address: string | null;
  shippingMethod: string | null;
  trackingCode: string | null;
  items: { id: string; name: string; detail: string; quantity: number }[];
};

export async function getPrintableOrders(sellerId: string, selection: PrintSelection): Promise<PrintableOrder[]> {
  if (selection.kind === "ids" && selection.ids.length === 0) return [];

  const where: Prisma.OrderWhereInput =
    selection.kind === "ready"
      ? { sellerId, status: { in: [...READY_TO_SHIP] } }
      : { sellerId, id: { in: selection.ids } };

  const orders = await prisma.order.findMany({
    where,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: MAX_PRINT_ORDERS,
    select: {
      id: true,
      createdAt: true,
      shippingAddress: true,
      shippingMethod: true,
      trackingCode: true,
      customer: { select: { name: true, phone: true, address: true } },
      items: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          quantity: true,
          product: { select: { name: true } },
          productVariant: { select: { color: true, size: true } },
        },
      },
    },
  });

  return orders.map((o) => ({
    id: o.id,
    code: orderCode(o.id),
    createdAt: o.createdAt,
    customerName: o.customer.name,
    customerPhone: o.customer.phone,
    address: o.shippingAddress ?? o.customer.address,
    shippingMethod: shippingMethodLabel(o.shippingMethod),
    trackingCode: o.trackingCode,
    items: o.items.map((i) => ({
      id: i.id,
      name: i.product.name,
      detail: [i.productVariant?.color, i.productVariant?.size].filter(Boolean).join(" / "),
      quantity: i.quantity,
    })),
  }));
}
