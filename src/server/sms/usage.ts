import type { SmsKind } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { reportPeriods } from "@/server/reports/periods";

/**
 * The messages a plan's SMS quota counts: order messages to the store's
 * customers. Platform messages (login code, member invite, subscription
 * reminder) never use the quota and are never limited (A9).
 */
export const QUOTA_SMS_KINDS = ["ORDER_PLACED", "ORDER_PAID", "ORDER_SHIPPED", "PAYMENT_REMINDER"] as const satisfies SmsKind[];

/**
 * Order SMS a store sent this Jalali month (Tehran time, the same month as the
 * sales report in B5), for plan quotas (A9). Counts what actually went out:
 * SENT, and DEV in development. Failed and pending messages don't count.
 */
export async function countSmsThisMonth(sellerId: string, now: Date = new Date()): Promise<number> {
  return prisma.smsMessage.count({
    where: {
      sellerId,
      kind: { in: [...QUOTA_SMS_KINDS] },
      status: { in: ["SENT", "DEV"] },
      createdAt: { gte: reportPeriods(now).month },
    },
  });
}
