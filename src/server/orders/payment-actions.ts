"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireSeller } from "@/server/auth";
import { scheduleCustomerSms } from "@/server/notifications/schedule";
import { isPaymentMethod } from "./payment";
import { PaymentError, confirmPaymentInTx } from "./payment-store";
import { isWellFormedToken } from "./purchase-links";
import { clientIp, createRateLimiter } from "./rate-limit";
import { deleteReceipt, saveReceipt } from "./receipt-storage";
import { errorSummary } from "@/lib/error-summary";

export type PaymentActionState = { message?: string; ok?: boolean } | undefined;

const GENERIC_ERROR = "خطای غیرمنتظره‌ای رخ داد. دوباره تلاش کنید.";

function uploadedFile(formData: FormData, name: string): File | null {
  const value = formData.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}

// ---------------------------------------------------------------------------
// Seller
// ---------------------------------------------------------------------------

/** Seller confirms payment: PENDING_PAYMENT → PAID with method, time and optional receipt. */
export async function confirmPaymentAction(
  orderId: string,
  _prev: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  const seller = await requireSeller();

  const method = formData.get("method");
  if (!isPaymentMethod(method)) return { message: "روش پرداخت را انتخاب کنید." };
  // The receipt shown when the seller decided ("" = none). Only compared with
  // the order's own receipt: a new one from the customer stops the confirmation.
  const seen = formData.get("seenReceipt");
  if (typeof seen !== "string") return { message: "صفحه را تازه کنید و دوباره تلاش کنید." };
  const expectedReceiptKey = seen === "" ? null : seen;

  let receiptKey: string | undefined;
  const file = uploadedFile(formData, "receipt");
  if (file) {
    const saved = await saveReceipt(file);
    if (!saved.ok) return { message: saved.error };
    receiptKey = saved.key;
  }

  try {
    const { previousReceiptKey } = await prisma.$transaction((tx) =>
      confirmPaymentInTx(tx, {
        sellerId: seller.id,
        orderId,
        method,
        paidAt: new Date(),
        receiptKey,
        expectedReceiptKey,
      }),
    );
    await deleteReceipt(previousReceiptKey);
  } catch (err) {
    await deleteReceipt(receiptKey);
    if (err instanceof PaymentError) return { message: err.message };
    console.error("payment confirm failed", errorSummary(err));
    return { message: GENERIC_ERROR };
  }

  await scheduleCustomerSms("ORDER_PAID", orderId);
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}

/** Seller rejects an uploaded receipt so the customer can send a new one. */
export async function rejectReceiptAction(
  orderId: string,
  _prev: PaymentActionState,
  _formData: FormData,
): Promise<PaymentActionState> {
  void _formData;
  const seller = await requireSeller();

  const order = await prisma.order.findFirst({
    where: { id: orderId, sellerId: seller.id },
    select: { status: true, receiptImageUrl: true },
  });
  if (!order?.receiptImageUrl || order.status !== "PENDING_PAYMENT") {
    return { message: "رسیدی برای رد کردن نیست." };
  }

  // Only clears the exact receipt the seller was looking at.
  const { count } = await prisma.order.updateMany({
    where: {
      id: orderId,
      sellerId: seller.id,
      status: "PENDING_PAYMENT",
      receiptImageUrl: order.receiptImageUrl,
    },
    data: { receiptImageUrl: null },
  });
  if (count === 1) await deleteReceipt(order.receiptImageUrl);

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Customer (PUBLIC, no login: the order is found by its unguessable token)
// ---------------------------------------------------------------------------

const receiptLimiter = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });

export async function uploadReceiptAction(
  publicToken: string,
  _prev: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  if (!isWellFormedToken(publicToken)) return { message: "سفارش پیدا نشد." };

  const file = uploadedFile(formData, "receipt");
  if (!file) return { message: "تصویر رسید را انتخاب کنید." };

  if (!receiptLimiter.hit(clientIp(await headers()))) {
    return { message: "تعداد ارسال‌ها زیاد است. چند دقیقه دیگر دوباره تلاش کنید." };
  }

  const order = await prisma.order.findUnique({
    where: { publicToken },
    select: { id: true, status: true, receiptImageUrl: true },
  });
  if (!order) return { message: "سفارش پیدا نشد." };
  if (order.status !== "PENDING_PAYMENT") return { message: "پرداخت این سفارش قبلاً ثبت شده است." };

  const saved = await saveReceipt(file);
  if (!saved.ok) return { message: saved.error };

  // Replaces only the receipt read above: with two uploads at once, one wins
  // and the other's file is removed, so no receipt image is left behind.
  const { count } = await prisma.order.updateMany({
    where: { id: order.id, status: "PENDING_PAYMENT", receiptImageUrl: order.receiptImageUrl },
    data: { receiptImageUrl: saved.key },
  });
  if (count !== 1) {
    await deleteReceipt(saved.key);
    const now = await prisma.order.findUnique({ where: { id: order.id }, select: { status: true } });
    return {
      message:
        now?.status === "PENDING_PAYMENT"
          ? "رسید دیگری همزمان ارسال شد. صفحه را تازه کنید."
          : "پرداخت این سفارش قبلاً ثبت شده است.",
    };
  }
  await deleteReceipt(order.receiptImageUrl);

  revalidatePath(`/buy/order/${publicToken}`);
  revalidatePath("/orders");
  revalidatePath(`/orders/${order.id}`);
  return { ok: true };
}
