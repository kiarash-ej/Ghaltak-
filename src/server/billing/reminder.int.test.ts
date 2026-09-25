import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import type { SendSms } from "@/server/sms/types";
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
  const okSend = () => vi.fn<SendSms>(async () => ({ ok: true, status: "SENT" }));

  it("sends one SMS within 3 days of the end, with the Jalali date and store name", async () => {
    const s = await store("BASIC", new Date(Date.now() + 2 * DAY));
    const send = okSend();
    const results = await Promise.all([
      remindSubscriptionEnding(s.id, { send }),
      remindSubscriptionEnding(s.id, { send }),
    ]);
    expect(results.sort()).toEqual(["not-due", "sent"]);
    expect(await remindSubscriptionEnding(s.id, { send })).toBe("not-due");
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ to: s.mobile, kind: "SUBSCRIPTION_REMINDER" });
    expect(send.mock.calls[0][0].tokens[1]).toBe("بوتیک رز");
  });

  it("not before 3 days, not on FREE, not with billing off", async () => {
    const send = okSend();
    expect(await remindSubscriptionEnding((await store("TRIAL", new Date(Date.now() + 5 * DAY))).id, { send })).toBe("not-due");
    expect(await remindSubscriptionEnding((await store("FREE", new Date())).id, { send })).toBe("not-due");
    process.env.BILLING_ENABLED = "false";
    expect(await remindSubscriptionEnding((await store("TRIAL", new Date(Date.now() + DAY))).id, { send })).toBe("not-due");
    expect(send).not.toHaveBeenCalled();
  });

  it("a failed SMS is tried again on the next visit; a renewed period gets its own reminder", async () => {
    const s = await store("TRIAL", new Date(Date.now() + DAY));
    const failing = vi.fn<SendSms>(async () => ({ ok: false, reason: "PROVIDER_ERROR" }));
    expect(await remindSubscriptionEnding(s.id, { send: failing })).toBe("failed");
    const send = okSend();
    expect(await remindSubscriptionEnding(s.id, { send })).toBe("sent");

    await prisma.subscription.update({
      where: { sellerId: s.id },
      data: { plan: "BASIC", currentPeriodEnd: new Date(Date.now() + 30 * DAY) },
    });
    expect(await remindSubscriptionEnding(s.id, { send, now: new Date(Date.now() + 28 * DAY) })).toBe("sent");
  });
});
