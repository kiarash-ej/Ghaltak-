"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSeller } from "@/server/auth";
import { parseShippingForm, shipBlocker, shippingStatusFor } from "./shipping";
import { canTransition } from "./status";

export type ShippingFormState =
  | { errors?: Record<string, string[]>; message?: string; ok?: boolean }
  | undefined;

/**
 * Saves the order's shipping details. With intent=ship it also moves the order
 * PREPARING → SHIPPED, which requires a shipping method.
 */
export async function saveShippingAction(
  orderId: string,
  _prev: ShippingFormState,
  formData: FormData,
): Promise<ShippingFormState> {
  const seller = await requireSeller();

  const parsed = parseShippingForm(formData);
  if (!parsed.success) return { errors: parsed.errors };
  const input = parsed.data;
  const ship = formData.get("intent") === "ship";

  const order = await prisma.order.findFirst({
    where: { id: orderId, sellerId: seller.id },
    select: { status: true },
  });
  if (!order) return { message: "سفارش پیدا نشد." };
  if (order.status === "CANCELED" || order.status === "RETURNED") {
    return { message: "این سفارش بسته شده است." };
  }
  if (ship) {
    if (!canTransition(order.status, "SHIPPED")) {
      return { message: "فقط سفارش «در حال آماده‌سازی» را می‌توان ارسال کرد." };
    }
    const blocker = shipBlocker({ shippingMethod: input.method });
    if (blocker) return { message: blocker };
  }

  // The seller can mark a shipment in transit or failed only while it is out.
  const manualShippingStatus =
    order.status === "SHIPPED" && input.shippingStatus ? input.shippingStatus : undefined;

  const { count } = await prisma.order.updateMany({
    // Conditional on the status we checked, so a concurrent change can't be overwritten.
    where: { id: orderId, sellerId: seller.id, status: order.status },
    data: {
      shippingMethod: input.method,
      shippingCost: input.cost,
      trackingCode: input.trackingCode,
      ...(ship
        ? { status: "SHIPPED", shippingStatus: shippingStatusFor("SHIPPED") }
        : manualShippingStatus
          ? { shippingStatus: manualShippingStatus }
          : {}),
    },
  });
  if (count !== 1) return { message: "وضعیت سفارش همزمان تغییر کرد. صفحه را تازه کنید." };

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}
