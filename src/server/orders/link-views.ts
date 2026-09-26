import "server-only";
import { prisma } from "@/lib/prisma";
import { tehranDateKey } from "@/server/reports/periods";
import { errorSummary } from "@/lib/error-summary";

/**
 * One more view of a purchase link today (Tehran day), for the funnel (B8).
 * Only a counter: no IP, user agent or anything else about the visitor.
 *
 * A single INSERT … ON CONFLICT, so simultaneous visitors can't lose an
 * increment. Never throws: a missed count must not break the buy page.
 */
export async function recordLinkView(purchaseLinkId: string, now = new Date()): Promise<void> {
  try {
    await prisma.$executeRaw`
      INSERT INTO "LinkDailyView" ("purchaseLinkId", "day", "views")
      VALUES (${purchaseLinkId}, ${tehranDateKey(now)}::date, 1)
      ON CONFLICT ("purchaseLinkId", "day") DO UPDATE SET "views" = "LinkDailyView"."views" + 1`;
  } catch (err) {
    console.error("recording a purchase-link view failed", errorSummary(err));
  }
}
