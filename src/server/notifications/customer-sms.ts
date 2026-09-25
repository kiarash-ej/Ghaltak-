import "server-only";
import { prisma } from "@/lib/prisma";
import { canUse as realCanUse } from "@/server/billing/usage";
import type { CanUse } from "@/server/billing/types";
import { UNPAID_ORDER_TTL_HOURS } from "@/server/orders/purchase-limits";
import { orderCode } from "@/server/orders/queries";
import { sendSms as realSendSms } from "@/server/sms/send";
import type { SendSms, SendSmsResult } from "@/server/sms/types";
import { SMS_SWITCH, customerSmsTokens, type CustomerSmsKind } from "./customer-sms-tokens";

// Automatic SMS to the customer about their order (Phase 2, B7).
//
// Rules (docs/phase2/TRACK-B.md):
// - Called AFTER the order's transaction commits (from after(), so nobody
//   waits for the SMS provider), never inside it.
// - At most one message per (order, kind): sendSms claims the SmsMessage row
//   first, so repeated calls return DUPLICATE and send nothing.
// - Never throws; a failed SMS never breaks an order.
// - The seller's switch for the event, then the plan quota (canUse "extraSms",
//   A9). Over quota: not sent, and the order is still fine (decision 3).

export type NotifyResult = SendSmsResult | { ok: false; reason: "SWITCHED_OFF" | "NO_ORDER" };

type Deps = { send?: SendSms; canUse?: CanUse };

export async function notifyCustomer(
  kind: CustomerSmsKind,
  orderId: string,
  opts: { origin: string } & Deps,
): Promise<NotifyResult> {
  const send = opts.send ?? realSendSms;
  const allowed = opts.canUse ?? realCanUse;
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        sellerId: true,
        publicToken: true,
        trackingCode: true,
        customer: { select: { phone: true } },
        seller: { select: { smsOnOrderPlaced: true, smsOnPaid: true, smsOnShipped: true } },
      },
    });
    if (!order?.publicToken) return { ok: false, reason: "NO_ORDER" };
    if (!order.seller[SMS_SWITCH[kind]]) return { ok: false, reason: "SWITCHED_OFF" };
    if (!(await allowed(order.sellerId, "extraSms"))) return { ok: false, reason: "QUOTA" };

    return await send({
      sellerId: order.sellerId,
      to: order.customer.phone,
      kind,
      orderId: order.id,
      tokens: customerSmsTokens(kind, {
        orderCode: orderCode(order.id),
        orderUrl: `${opts.origin}/buy/order/${order.publicToken}`,
        trackingCode: order.trackingCode,
      }),
    });
  } catch (err) {
    console.error(`[customer sms] ${kind} could not be prepared:`, (err as Error)?.name);
    return { ok: false, reason: "ERROR" };
  }
}

/** Hours before expiry when the unpaid-order reminder goes out. */
export const REMINDER_HOURS_BEFORE_EXPIRY = 24;

/**
 * Reminds customers whose purchase-link order is still unpaid and will expire
 * within REMINDER_HOURS_BEFORE_EXPIRY (P1). Runs lazily next to the expiry
 * (after the seller's order list and new link orders), like expireUnpaidLinkOrders;
 * sendSms's (order, kind) claim keeps it to one reminder per order.
 */
export async function remindUnpaidOrders(
  sellerId: string,
  opts: { origin: string; now?: Date } & Deps,
): Promise<number> {
  const now = opts.now ?? new Date();
  const hour = 60 * 60 * 1000;
  const due = await prisma.order.findMany({
    where: {
      sellerId,
      source: "PURCHASE_LINK",
      status: "PENDING_PAYMENT",
      receiptImageUrl: null,
      createdAt: {
        lt: new Date(now.getTime() - (UNPAID_ORDER_TTL_HOURS - REMINDER_HOURS_BEFORE_EXPIRY) * hour),
        gt: new Date(now.getTime() - UNPAID_ORDER_TTL_HOURS * hour),
      },
      smsMessages: { none: { kind: "PAYMENT_REMINDER" } },
    },
    take: 20,
    select: { id: true },
  });
  let sent = 0;
  for (const o of due) {
    const r = await notifyCustomer("PAYMENT_REMINDER", o.id, opts);
    if (r.ok && r.status !== "DUPLICATE") sent += 1;
  }
  return sent;
}
