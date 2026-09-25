"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSeller } from "@/server/auth";
import { scheduleCustomerSms } from "@/server/notifications/schedule";
import { OrderError, createOrderInTx } from "./create-order";
import { parseOrderForm, type FieldErrors } from "./order-form";
import { shippingStatusFor } from "./shipping";
import {
  STATUS_LABELS,
  canTransition,
  detailsRequiredFor,
  isOrderStatus,
  restoresStock,
} from "./status";
import { OutOfStockError, returnStock } from "./stock";

export type OrderFormState = { errors?: FieldErrors; message?: string } | undefined;
export type StatusChangeState = { message?: string } | undefined;

const GENERIC_ERROR = "خطای غیرمنتظره‌ای رخ داد. دوباره تلاش کنید.";

/** A rejected status change; the message is shown to the seller. */
class StatusError extends Error {}

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
    const order = await prisma.$transaction((tx) =>
      createOrderInTx(tx, { ...input, sellerId: seller.id, source: "MANUAL" }),
    );
    orderId = order.id;
  } catch (err) {
    if (err instanceof OrderError) return { errors: { [err.field]: [err.message] } };
    if (err instanceof OutOfStockError) {
      return { errors: { items: ["موجودی یکی از کالاها کافی نیست."] } };
    }
    console.error("order create failed", err);
    return { message: GENERIC_ERROR };
  }

  await scheduleCustomerSms("ORDER_PLACED", orderId);
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
  if (detailsRequiredFor(to)) return { message: "این تغییر وضعیت از فرم مخصوص خودش انجام می‌شود." };

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, sellerId: seller.id },
        select: { status: true },
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
        data: { status: to, shippingStatus: shippingStatusFor(to) },
      });
      if (count !== 1) throw new StatusError("وضعیت سفارش همزمان تغییر کرد. صفحه را تازه کنید.");

      if (restoresStock(to)) {
        await returnStock(orderId, to === "RETURNED" ? "ORDER_RETURNED" : "ORDER_CANCELED", tx);
      }
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
