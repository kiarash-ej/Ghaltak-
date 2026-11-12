import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import type { NotifySeller } from "@/server/notifications/seller-notifications";
import { hasTestDatabase } from "@/test/setup";
import { remindSubscriptionEnding } from "./reminder";

const DAY = 24 * 60 * 60 * 1000;

describe.skipIf(!hasTestDatabase)("subscription reminder (database)", () => {
  const runId = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  const sellerIds: string[] = [];
  let n = 0;
  const previous = process.env.BILLING_ENABLED;

  beforeEach(() => {
    process.env.BILLING_ENABLED = "true";
  });
  afterEach(() => {
    process.env.BILLING_ENABLED = previous;
  });
  afterAll(async () => {
    await prisma.seller.deleteMany({ where: { id: { in: sellerIds } } });
    await prisma.$disconnect();
  });

  async function store(plan: "TRIAL" | "BASIC" | "FREE", periodEnd: Date) {
    const s = await prisma.seller.create({
      data: {
        name: "بوتیک رز",
        mobile: `0993${runId.slice(-5)}${String(n++).padStart(2, "0")}`,
        subscription: { create: { plan, currentPeriodEnd: periodEnd } },
      },
    });
    sellerIds.push(s.id);
    return s;
  }
  const failing = vi.fn<NotifySeller>(async () => "failed");
  const reminders = (sellerId: string) =>
    prisma.notification.findMany({ where: { sellerId, kind: "SUBSCRIPTION_ENDING" }, orderBy: { createdAt: "asc" } });

  it("makes one owner-only notification within 3 days of the end, and no SMS", async () => {
    const s = await store("BASIC", new Date(Date.now() + 2 * DAY));
    const results = await Promise.all([remindSubscriptionEnding(s.id), remindSubscriptionEnding(s.id)]);
    expect(results.sort()).toEqual(["not-due", "sent"]);
    expect(await remindSubscriptionEnding(s.id)).toBe("not-due");

    const rows = await reminders(s.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ ownerOnly: true, readAt: null, orderId: null });
    expect(rows[0].text).toContain("اشتراک");
    expect(await prisma.smsMessage.count({ where: { sellerId: s.id } })).toBe(0);
  });

  it("not before 3 days, not on FREE, not with billing off", async () => {
    const ids = [
      (await store("TRIAL", new Date(Date.now() + 5 * DAY))).id,
      (await store("FREE", new Date())).id,
    ];
    for (const id of ids) expect(await remindSubscriptionEnding(id)).toBe("not-due");
    process.env.BILLING_ENABLED = "false";
    const off = (await store("TRIAL", new Date(Date.now() + DAY))).id;
    expect(await remindSubscriptionEnding(off)).toBe("not-due");
    expect(await prisma.notification.count({ where: { sellerId: { in: [...ids, off] } } })).toBe(0);
  });

  it("a failed notification is tried again on the next visit; a renewed period gets its own reminder", async () => {
    const s = await store("TRIAL", new Date(Date.now() + DAY));
    expect(await remindSubscriptionEnding(s.id, { notify: failing })).toBe("failed");
    expect(await remindSubscriptionEnding(s.id)).toBe("sent");
    expect((await reminders(s.id))[0].text).toContain("دورهٔ آزمایشی");

    await prisma.subscription.update({
      where: { sellerId: s.id },
      data: { plan: "BASIC", currentPeriodEnd: new Date(Date.now() + 30 * DAY) },
    });
    expect(await remindSubscriptionEnding(s.id, { now: new Date(Date.now() + 28 * DAY) })).toBe("sent");
    expect(await reminders(s.id)).toHaveLength(2);
  });
});
