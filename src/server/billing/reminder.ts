import "server-only";
import { after } from "next/server";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { sendSms as realSendSms } from "@/server/sms/send";
import type { SendSms } from "@/server/sms/types";
import { billingEnabled } from "./config";
import { REMINDER_DAYS_BEFORE_END } from "./plans";
import { effectivePlan } from "./state";

// SUBSCRIPTION_REMINDER (A9): an SMS to the store's mobile REMINDER_DAYS_BEFORE_END
// days before a trial or paid period ends, once per period. Iranian gateways
// can't charge a card again by themselves, so renewal is manual.
//
// Runs lazily when the seller opens the dashboard, like B7's unpaid-order
// reminders (there is no job runner). Template tokens (DEPLOY.md, C3):
// token = the period's end date in Jalali, token2 = the store's name.

const DAY_MS = 24 * 60 * 60 * 1000;

export async function remindSubscriptionEnding(
  sellerId: string,
  opts: { now?: Date; send?: SendSms } = {},
): Promise<"sent" | "not-due" | "failed"> {
  if (!billingEnabled()) return "not-due";
  const now = opts.now ?? new Date();
  const send = opts.send ?? realSendSms;

  const seller = await prisma.seller.findUnique({
    where: { id: sellerId },
    select: {
      name: true,
      mobile: true,
      subscription: {
        select: { plan: true, currentPeriodEnd: true, nextPlan: true, nextPlanFrom: true, reminderSentFor: true },
      },
    },
  });
  const sub = seller?.subscription;
  if (!seller || !sub) return "not-due";
  const effective = effectivePlan(sub, now, { billingEnabled: true });
  const end = sub.currentPeriodEnd;
  const due =
    (effective.state === "TRIAL" || effective.state === "ACTIVE") &&
    now.getTime() >= end.getTime() - REMINDER_DAYS_BEFORE_END * DAY_MS;
  if (!due || sub.reminderSentFor?.getTime() === end.getTime()) return "not-due";

  // Claim this period's reminder first, so two dashboards opened at once send one SMS.
  const claimed = await prisma.subscription.updateMany({
    where: {
      sellerId,
      currentPeriodEnd: end,
      OR: [{ reminderSentFor: null }, { reminderSentFor: { not: end } }],
    },
    data: { reminderSentFor: end },
  });
  if (claimed.count === 0) return "not-due";

  const result = await send({
    sellerId,
    to: seller.mobile,
    kind: "SUBSCRIPTION_REMINDER",
    tokens: [formatDate(end), seller.name],
  });
  if (result.ok) return "sent";
  // Let the next dashboard visit try again.
  await prisma.subscription.updateMany({
    where: { sellerId, reminderSentFor: end },
    data: { reminderSentFor: sub.reminderSentFor },
  });
  return "failed";
}

/** From the dashboard: after the response, never throws. */
export function scheduleSubscriptionReminder(sellerId: string): void {
  after(() =>
    remindSubscriptionEnding(sellerId).catch((err: unknown) =>
      console.error("[subscription reminder] failed:", (err as Error)?.name),
    ),
  );
}
