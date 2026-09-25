import { prisma } from "@/lib/prisma";
import { reportPeriods } from "@/server/reports/periods";

/**
 * SMS a store sent this Jalali month (Tehran time, the same month as the sales
 * report in B5), for plan quotas (A9). Counts what actually went out: SENT,
 * and DEV in development. Failed and pending messages don't count.
 */
export async function countSmsThisMonth(sellerId: string, now: Date = new Date()): Promise<number> {
  return prisma.smsMessage.count({
    where: {
      sellerId,
      status: { in: ["SENT", "DEV"] },
      createdAt: { gte: reportPeriods(now).month },
    },
  });
}
