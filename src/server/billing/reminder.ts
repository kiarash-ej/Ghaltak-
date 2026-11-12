import "server-only";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { subscriptionEndingText } from "@/server/notifications/seller-notification-text";
import { notifySeller, type NotifySeller } from "@/server/notifications/seller-notifications";
import { billingEnabled } from "./config";
import { REMINDER_DAYS_BEFORE_END } from "./plans";
import { effectivePlan } from "./state";

// The renewal reminder (A9): an in-app notification for the owner
// REMINDER_DAYS_BEFORE_END days before a trial or paid period ends, once per
// period. Iranian gateways can't charge a card again by themselves, so renewal
// is manual.
//
// Runs lazily when the seller opens the dashboard (there is no job runner).
// It used to be an SMS (SUBSCRIPTION_REMINDER), but it only ever went out
// while the seller was already in the app, so the SMS bought nothing.

const DAY_MS = 24 * 60 * 60 * 1000;

export async function remindSubscriptionEnding(
  sellerId: string,
  opts: { now?: Date; notify?: NotifySeller } = {},
): Promise<"sent" | "not-due" | "failed"> {
  if (!billingEnabled()) return "not-due";
  const now = opts.now ?? new Date();
  const notify = opts.notify ?? notifySeller;

  const seller = await prisma.seller.findUnique({
    where: { id: sellerId },
    select: {
      subscription: {
        select: { plan: true, currentPeriodEnd: true, nextPlan: true, nextPlanFrom: true, reminderSentFor: true },
      },
    },
  });
  const sub = seller?.subscription;
  if (!seller || !sub) return "not-due";
  const effective = effectivePlan(sub, now, { billingEnabled: true });
  const end = sub.currentPeriodEnd;
  if (effective.state !== "TRIAL" && effective.state !== "ACTIVE") return "not-due";
  const due = now.getTime() >= end.getTime() - REMINDER_DAYS_BEFORE_END * DAY_MS;
  if (!due || sub.reminderSentFor?.getTime() === end.getTime()) return "not-due";

  // Claim this period's reminder first, so two dashboards opened at once make one.
  const claimed = await prisma.subscription.updateMany({
    where: {
      sellerId,
      currentPeriodEnd: end,
      OR: [{ reminderSentFor: null }, { reminderSentFor: { not: end } }],
    },
    data: { reminderSentFor: end },
  });
  if (claimed.count === 0) return "not-due";

  const result = await notify({
    sellerId,
    kind: "SUBSCRIPTION_ENDING",
    text: subscriptionEndingText(effective.state, end),
    dedupeKey: `SUBSCRIPTION_ENDING:${sellerId}:${end.toISOString()}`,
    ownerOnly: true,
  });
  if (result !== "failed") return "sent";
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
