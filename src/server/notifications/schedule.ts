import "server-only";
import { after } from "next/server";
import { requestOrigin } from "@/server/payments/request-origin";
import type { CustomerSmsKind } from "./customer-sms-tokens";
import { notifyCustomer, remindUnpaidOrders } from "./customer-sms";

// Queue customer SMS to run after the response is sent (next/server after()):
// the order's transaction has committed by then, and nobody waits for the SMS
// provider. Call only from a request (server action, route handler, page).
// Never throws: the order change has already happened, and an SMS problem
// must not turn it into an error for the seller or the customer.

/** The origin for links in the SMS, or null (logged) if it can't be known. */
async function smsOrigin(): Promise<string | null> {
  try {
    return await requestOrigin();
  } catch (err) {
    console.error("[customer sms] skipped:", (err as Error)?.message);
    return null;
  }
}

export async function scheduleCustomerSms(kind: CustomerSmsKind, orderId: string): Promise<void> {
  const origin = await smsOrigin();
  if (!origin) return;
  after(() => notifyCustomer(kind, orderId, { origin }));
}

export async function scheduleUnpaidReminders(sellerId: string): Promise<void> {
  const origin = await smsOrigin();
  if (!origin) return;
  after(() =>
    remindUnpaidOrders(sellerId, { origin }).catch((err: unknown) =>
      console.error("[customer sms] reminders failed:", (err as Error)?.name),
    ),
  );
}
