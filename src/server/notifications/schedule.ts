import "server-only";
import { after } from "next/server";
import { requestOrigin } from "@/server/payments/request-origin";
import type { CustomerSmsKind } from "./customer-sms-tokens";
import { notifyCustomer, remindUnpaidOrders } from "./customer-sms";

// Queue customer SMS to run after the response is sent (next/server after()):
// the order's transaction has committed by then, and nobody waits for the SMS
// provider. Call only from a request (server action, route handler, page).

export async function scheduleCustomerSms(kind: CustomerSmsKind, orderId: string): Promise<void> {
  const origin = await requestOrigin();
  after(() => notifyCustomer(kind, orderId, { origin }));
}

export async function scheduleUnpaidReminders(sellerId: string): Promise<void> {
  const origin = await requestOrigin();
  after(() =>
    remindUnpaidOrders(sellerId, { origin }).catch((err: unknown) =>
      console.error("[customer sms] reminders failed:", (err as Error)?.name),
    ),
  );
}
