"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorSummary } from "@/lib/error-summary";
import { prisma } from "@/lib/prisma";
import { requireSeller } from "@/server/auth";
import { scheduleCustomerSms } from "@/server/notifications/schedule";
import { OrderError, createOrderInTx } from "./create-order";
import { parseOrderForm, type FieldErrors } from "./order-form";
import { detailsRequiredFor, isOrderStatus } from "./status";
import { StatusError, changeOrderStatus } from "./status-change";
import { OutOfStockError } from "./stock";

export type OrderFormState = { errors?: FieldErrors; message?: string } | undefined;
export type StatusChangeState = { message?: string } | undefined;

const GENERIC_ERROR = "خطای غیرمنتظره‌ای رخ داد. دوباره تلاش کنید.";

/** A rejected status change; the message is shown to the seller. */
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
    console.error("order create failed", errorSummary(err));
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
    await changeOrderStatus(seller.id, orderId, to);
  } catch (err) {
    if (err instanceof StatusError) return { message: err.message };
    console.error("order status change failed", errorSummary(err));
    return { message: GENERIC_ERROR };
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  return undefined;
}
