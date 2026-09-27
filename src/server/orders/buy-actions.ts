"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { scheduleCustomerSms, scheduleUnpaidReminders } from "@/server/notifications/schedule";
import { parseBuyForm } from "./buy-form";
import { OrderError } from "./create-order";
import { QuotaError, placeLinkOrder } from "./link-order";
import type { FieldErrors } from "./order-form";
import { getPublicLink } from "./purchase-links";
import { clientIp, createRateLimiter } from "./rate-limit";
import { OutOfStockError } from "./stock";
import { errorSummary } from "@/lib/error-summary";

// PUBLIC action behind /buy/[token]: no login. The seller comes from the
// link token only, never from anything the visitor sends.

export type BuyFormState = { errors?: FieldErrors; message?: string } | undefined;

// Generous on purpose: many Iranian mobile users share an IP (carrier NAT).
const orderLimiter = createRateLimiter({ limit: 10, windowMs: 10 * 60 * 1000 });

const GENERIC_ERROR = "خطایی رخ داد. لطفاً دوباره تلاش کنید.";

export async function submitPurchaseAction(
  token: string,
  _prev: BuyFormState,
  formData: FormData,
): Promise<BuyFormState> {
  const parsed = parseBuyForm(formData);
  if (!parsed.success) return { errors: parsed.errors };

  if (!orderLimiter.hit(clientIp(await headers()))) {
    return { message: "تعداد سفارش‌ها از این اتصال زیاد است. چند دقیقه دیگر دوباره تلاش کنید." };
  }

  const link = await getPublicLink(token);
  if (!link) return { message: "این لینک خرید دیگر فعال نیست." };

  let publicToken: string;
  let orderId: string;
  try {
    ({ publicToken, id: orderId } = await placeLinkOrder(link, parsed.data));
  } catch (err) {
    if (err instanceof QuotaError) return { message: err.message };
    if (err instanceof OrderError) return { errors: { items: [err.message] } };
    if (err instanceof OutOfStockError) {
      return { errors: { items: ["موجودی یکی از کالاها کافی نیست."] } };
    }
    console.error("purchase-link order failed", errorSummary(err));
    return { message: GENERIC_ERROR };
  }

  await scheduleCustomerSms("ORDER_PLACED", orderId);
  await scheduleUnpaidReminders(link.sellerId);
  revalidatePath("/orders");
  redirect(`/buy/order/${publicToken}`);
}
