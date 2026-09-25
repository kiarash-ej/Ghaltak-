import "server-only";
import type { OrderStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { variantLabel } from "@/server/catalog/labels";
import { PAYMENT_METHOD_LABELS, amountDue } from "@/server/orders/payment";
import { orderCode } from "@/server/orders/queries";
import { SHIPPING_STATUS_LABELS, shippingMethodLabel } from "@/server/orders/shipping";
import { STATUS_LABELS, isOrderStatus } from "@/server/orders/status";
import { SALE_STATUSES } from "@/server/reports/queries";
import { formatPhone, yesNo, type CsvValue } from "./csv";
import { formatJalaliDate, formatTehranTime, jalaliDayEnd, jalaliDayStart, parseJalaliDate } from "./jalali";

// Orders (C6), optionally for a Jalali date range and one status. "Sale" is
// the sales report's definition (B5). Only what the seller sees on the order
// page: never a card number, Sheba, gateway detail or online-payment record.

export const ORDER_HEADER = [
  "کد سفارش",
  "تاریخ",
  "ساعت",
  "وضعیت",
  "فروش",
  "منبع",
  "نام مشتری",
  "موبایل مشتری",
  "کالاها",
  "جمع کالاها (تومان)",
  "هزینهٔ ارسال (تومان)",
  "مبلغ کل (تومان)",
  "روش پرداخت",
  "زمان پرداخت",
  "روش ارسال",
  "وضعیت ارسال",
  "کد رهگیری",
  "آدرس ارسال",
];

export type OrderFilter = { from?: Date; to?: Date; status?: OrderStatus };

export type OrderFilterError = "from" | "to" | "range" | "status";

/** Reads ?from=1405/07/01&to=1405/07/30&status=PAID. Dates are whole Tehran days, both included. */
export function parseOrderFilter(params: URLSearchParams): { ok: true; filter: OrderFilter } | { ok: false; error: OrderFilterError } {
  const filter: OrderFilter = {};
  const from = params.get("from")?.trim();
  const to = params.get("to")?.trim();
  const status = params.get("status")?.trim();
  if (from) {
    const d = parseJalaliDate(from);
    if (!d) return { ok: false, error: "from" };
    filter.from = jalaliDayStart(d);
  }
  if (to) {
    const d = parseJalaliDate(to);
    if (!d) return { ok: false, error: "to" };
    filter.to = jalaliDayEnd(d);
  }
  if (filter.from && filter.to && filter.from >= filter.to) return { ok: false, error: "range" };
  if (status) {
    if (!isOrderStatus(status)) return { ok: false, error: "status" };
    filter.status = status;
  }
  return { ok: true, filter };
}

const SALE = new Set<OrderStatus>(SALE_STATUSES);

export async function* orderRows(
  sellerId: string,
  filter: OrderFilter,
  opts: { batchSize?: number } = {},
): AsyncGenerator<CsvValue[][]> {
  const take = opts.batchSize ?? 200;
  const where: Prisma.OrderWhereInput = {
    sellerId,
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.from || filter.to
      ? { createdAt: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lt: filter.to } : {}) } }
      : {}),
  };
  let cursor: string | undefined;
  for (;;) {
    const orders = await prisma.order.findMany({
      where,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        status: true,
        source: true,
        totalPrice: true,
        shippingCost: true,
        paymentMethod: true,
        paidAt: true,
        shippingMethod: true,
        shippingStatus: true,
        trackingCode: true,
        shippingAddress: true,
        createdAt: true,
        customer: { select: { name: true, phone: true } },
        items: {
          orderBy: { id: "asc" },
          select: {
            quantity: true,
            product: { select: { name: true } },
            productVariant: { select: { color: true, size: true } },
          },
        },
      },
    });
    if (orders.length === 0) return;
    cursor = orders[orders.length - 1].id;

    yield orders.map((o) => [
      orderCode(o.id),
      formatJalaliDate(o.createdAt),
      formatTehranTime(o.createdAt),
      STATUS_LABELS[o.status],
      yesNo(SALE.has(o.status)),
      o.source === "PURCHASE_LINK" ? "لینک خرید" : "دستی",
      o.customer.name,
      formatPhone(o.customer.phone),
      o.items
        .map((i) => `${i.product.name}${i.productVariant ? ` (${variantLabel(i.productVariant)})` : ""} × ${i.quantity}`)
        .join("؛ "),
      o.totalPrice,
      o.shippingCost,
      amountDue(o),
      o.paymentMethod ? PAYMENT_METHOD_LABELS[o.paymentMethod] : null,
      o.paidAt ? `${formatJalaliDate(o.paidAt)} ${formatTehranTime(o.paidAt)}` : null,
      shippingMethodLabel(o.shippingMethod),
      SHIPPING_STATUS_LABELS[o.shippingStatus],
      o.trackingCode,
      o.shippingAddress,
    ]);
    if (orders.length < take) return;
  }
}
