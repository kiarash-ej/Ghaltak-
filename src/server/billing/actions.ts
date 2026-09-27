"use server";

import { redirect } from "next/navigation";
import { requireOwner } from "@/server/auth";
import { requestOrigin } from "@/server/payments/request-origin";
import { SubscriptionPaymentError, startSubscriptionPayment } from "./subscription-payment";

// «پرداخت/تمدید» on /settings/billing. The seller comes from the session and
// the amount from plans.ts; the form only says which plan.
// Owner only (A10), checked here on the server.

export type SubscriptionPaymentState = { message?: string } | undefined;

export async function startSubscriptionPaymentAction(
  _prev: SubscriptionPaymentState,
  formData: FormData,
): Promise<SubscriptionPaymentState> {
  const seller = await requireOwner();
  const plan = String(formData.get("plan") ?? "");

  let redirectUrl: string;
  try {
    ({ redirectUrl } = await startSubscriptionPayment(seller.id, plan, { origin: await requestOrigin() }));
  } catch (err) {
    if (err instanceof SubscriptionPaymentError) return { message: err.message };
    const e = err as { name?: string; code?: string };
    console.error("[subscription payment] start failed", { name: e?.name, code: e?.code });
    return { message: "خطایی رخ داد. لطفاً دوباره تلاش کنید." };
  }
  redirect(redirectUrl);
}
