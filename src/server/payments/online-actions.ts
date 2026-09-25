"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isWellFormedToken } from "@/server/orders/purchase-links";
import { clientIp, createRateLimiter } from "@/server/orders/rate-limit";
import { OnlinePaymentError, startOnlinePayment } from "./online-payment";
import { requestOrigin } from "./request-origin";

// PUBLIC action on the customer's order page: "pay online". The order (and so
// the seller and the amount) comes from the unguessable order token only.

export type OnlinePaymentState = { message?: string } | undefined;

const startLimiter = createRateLimiter({ limit: 10, windowMs: 10 * 60 * 1000 });

export async function startOnlinePaymentAction(
  publicToken: string,
  _prev: OnlinePaymentState,
  _formData: FormData,
): Promise<OnlinePaymentState> {
  void _formData;
  if (!isWellFormedToken(publicToken)) return { message: "سفارش پیدا نشد." };
  if (!startLimiter.hit(clientIp(await headers()))) {
    return { message: "تعداد تلاش‌ها زیاد است. چند دقیقه دیگر دوباره تلاش کنید." };
  }

  let redirectUrl: string;
  try {
    ({ redirectUrl } = await startOnlinePayment(publicToken, { origin: await requestOrigin() }));
  } catch (err) {
    if (err instanceof OnlinePaymentError) return { message: err.message };
    console.error("online payment start failed:", (err as Error)?.name);
    return { message: "خطایی رخ داد. لطفاً دوباره تلاش کنید." };
  }
  redirect(redirectUrl);
}
