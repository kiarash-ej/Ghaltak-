"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSeller } from "@/server/auth";
import {
  MAX_ORDER_TOTAL,
  computeOrderTotal,
  parseOrderForm,
  type FieldErrors,
} from "./order-form";
import { STATUS_LABELS, canTransition, isOrderStatus, restoresStock } from "./status";
import { OutOfStockError, returnStock, takeStock } from "./stock";

export type OrderFormState = { errors?: FieldErrors; message?: string } | undefined;
export type StatusChangeState = { message?: string } | undefined;

const GENERIC_ERROR = "خطای غیرمنتظره‌ای رخ داد. دوباره تلاش کنید.";

/** A user-facing failure raised inside a transaction so everything rolls back. */
class OrderError extends Error {
  constructor(public readonly state: NonNullable<OrderFormState>) {
    super("order rejected");
  }
}

/** A rejected status change; the message is shown to the seller. */
class StatusError extends Error {}

function variantLabel(v: { color: string | null; size: string | null; product: { name: string } }) {
  const detail = [v.color, v.size].filter(Boolean).join(" / ");
  return detail ? `${v.product.name} (${detail})` : v.product.name;
}

export async function createOrderAction(
  _prev: OrderFormState,
  formData: FormData,
): Promise<OrderFormState> {
  const seller = await requireSeller();

  const parsed = parseOrderForm(formData);
  if (!parsed.success) return { errors: parsed.errors };
  const input = parsed.data;

  let orderId: string;
  try {
    orderId = await prisma.$transaction(async (tx) => {
      // Customer: an existing one must belong to this seller. A "new" one
      // reuses the seller's customer with the same phone if there is one.
      let customer: { id: string; address: string | null };
      if (input.customer.kind === "existing") {
        const found = await tx.customer.findFirst({
          where: { id: input.customer.id, sellerId: seller.id },
          select: { id: true, address: true },
        });
        if (!found) throw new OrderError({ errors: { customerId: ["مشتری پیدا نشد."] } });
        customer = found;
      } else {
        customer =
          (await tx.customer.findUnique({
            where: { sellerId_phone: { sellerId: seller.id, phone: input.customer.phone } },
            select: { id: true, address: true },
          })) ??
          (await tx.customer.create({
            data: {
              sellerId: seller.id,
              name: input.customer.name,
              phone: input.customer.phone,
              address: input.shippingAddress,
            },
            select: { id: true, address: true },
          }));
      }

      // Variants: only this seller's, only active products. Prices are read
      // here, never from the form, and snapshotted onto each OrderItem.
      const variants = await tx.productVariant.findMany({
        where: {
          id: { in: input.items.map((i) => i.variantId) },
          sellerId: seller.id,
          product: { isActive: true },
        },
        select: {
          id: true,
          stock: true,
          color: true,
          size: true,
          product: { select: { id: true, name: true, price: true } },
        },
      });
      const byId = new Map(variants.map((v) => [v.id, v]));

      const lines = input.items.map((item) => {
        const variant = byId.get(item.variantId);
        if (!variant) {
          throw new OrderError({ errors: { items: ["یکی از کالاها دیگر برای فروش موجود نیست."] } });
        }
        if (variant.stock < item.quantity) {
          throw new OrderError({
            errors: { items: [`موجودی «${variantLabel(variant)}» کافی نیست.`] },
          });
        }
        return {
          productId: variant.product.id,
          productVariantId: variant.id,
          quantity: item.quantity,
          unitPrice: variant.product.price,
        };
      });

      const totalPrice = computeOrderTotal(lines);
      if (totalPrice > MAX_ORDER_TOTAL) {
        throw new OrderError({ errors: { items: ["جمع سفارش بیش از حد مجاز است."] } });
      }

      const order = await tx.order.create({
        data: {
          sellerId: seller.id,
          customerId: customer.id,
          source: "MANUAL",
          status: "PENDING_PAYMENT",
          totalPrice,
          shippingAddress: input.shippingAddress ?? customer.address,
          publicToken: randomBytes(16).toString("base64url"),
          items: { create: lines },
        },
        select: { id: true },
      });

      await takeStock(lines, tx);
      return order.id;
    });
  } catch (err) {
    if (err instanceof OrderError) return err.state;
    if (err instanceof OutOfStockError) {
      return { errors: { items: ["موجودی یکی از کالاها کافی نیست."] } };
    }
    console.error("order create failed", err);
    return { message: GENERIC_ERROR };
  }

  revalidatePath("/orders");
  redirect(`/orders/${orderId}`);
}

export async function changeOrderStatusAction(
  orderId: string,
  _prev: StatusChangeState,
  formData: FormData,
): Promise<StatusChangeState> {
  const seller = await requireSeller();

  const to = formData.get("to");
  if (!isOrderStatus(to)) return { message: "وضعیت نامعتبر است." };

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, sellerId: seller.id },
        select: {
          status: true,
          paidAt: true,
          items: { select: { productVariantId: true, quantity: true } },
        },
      });
      if (!order) throw new StatusError("سفارش پیدا نشد.");
      if (!canTransition(order.status, to)) {
        throw new StatusError(
          `تغییر وضعیت از «${STATUS_LABELS[order.status]}» به «${STATUS_LABELS[to]}» مجاز نیست.`,
        );
      }

      // Only succeeds if nobody changed the status in the meantime, so stock
      // is restored at most once even with two clicks or two tabs.
      const { count } = await tx.order.updateMany({
        where: { id: orderId, sellerId: seller.id, status: order.status },
        data: {
          status: to,
          ...(to === "PAID" && !order.paidAt ? { paidAt: new Date() } : {}),
        },
      });
      if (count !== 1) throw new StatusError("وضعیت سفارش همزمان تغییر کرد. صفحه را تازه کنید.");

      if (restoresStock(to)) await returnStock(order.items, tx);
    });
  } catch (err) {
    if (err instanceof StatusError) return { message: err.message };
    console.error("order status change failed", err);
    return { message: GENERIC_ERROR };
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  return undefined;
}
