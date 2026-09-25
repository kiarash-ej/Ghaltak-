import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import type { PaymentGateway } from "@/server/payments/types";
import { hasTestDatabase } from "@/test/setup";
import { addJalaliMonth } from "./state";
import {
  SubscriptionPaymentError,
  handleSubscriptionReturn,
  retryStalePendingPayments,
  startSubscriptionPayment,
} from "./subscription-payment";

// Subscription payments against a real Postgres (A9 «انجام‌شده وقتی»):
// double return, wrong amount, period end, early renewal, plan change.

const DAY = 24 * 60 * 60 * 1000;
type VerifyResult = Awaited<ReturnType<PaymentGateway["verify"]>>;

type Scripted = {
  verifyResult: VerifyResult;
  verifyCalls: { authority: string; amount: number }[];
  requestAmounts: number[];
  client: PaymentGateway;
};

function scriptedGateway(): Scripted {
  let n = 0;
  const gw: Scripted = {
    verifyResult: { ok: true, refId: "REF-1", cardPanMasked: null, alreadyVerified: false } as VerifyResult,
    verifyCalls: [] as { authority: string; amount: number }[],
    requestAmounts: [] as number[],
    client: {
      provider: "ZARINPAL" as const,
      async request(input: { amount: number }) {
        n += 1;
        gw.requestAmounts.push(input.amount);
        const authority = `SUB-AUTH-${Date.now()}-${n}`;
        return { ok: true as const, authority, redirectUrl: `https://gateway.test/pay/${authority}` };
      },
      payUrl: (authority: string) => `https://gateway.test/pay/${authority}`,
      async verify(input: { authority: string; amount: number }) {
        gw.verifyCalls.push(input);
        return gw.verifyResult;
      },
    },
  };
  return gw;
}

describe.skipIf(!hasTestDatabase)("subscription payment (database)", () => {
  const runId = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  const sellerIds: string[] = [];
  let n = 0;
  let gw: ReturnType<typeof scriptedGateway>;
  const previous = process.env.BILLING_ENABLED;

  beforeEach(() => {
    process.env.BILLING_ENABLED = "true";
    gw = scriptedGateway();
  });
  afterEach(() => {
    process.env.BILLING_ENABLED = previous;
  });
  afterAll(async () => {
    await prisma.paymentAttempt.deleteMany({ where: { sellerId: { in: sellerIds } } });
    await prisma.invoice.deleteMany({ where: { sellerId: { in: sellerIds } } });
    await prisma.seller.deleteMany({ where: { id: { in: sellerIds } } });
    await prisma.$disconnect();
  });

  async function store(plan: "TRIAL" | "FREE" | "BASIC" | "PRO", periodEnd: Date) {
    const seller = await prisma.seller.create({
      data: {
        name: "فروشگاه",
        mobile: `0994${runId.slice(-5)}${String(n++).padStart(2, "0")}`,
        subscription: { create: { plan, status: "ACTIVE", currentPeriodEnd: periodEnd } },
      },
    });
    sellerIds.push(seller.id);
    return seller.id;
  }
  const sub = (sellerId: string) => prisma.subscription.findUniqueOrThrow({ where: { sellerId } });

  async function pay(sellerId: string, plan: string) {
    const { attemptId } = await startSubscriptionPayment(sellerId, plan, { origin: "https://ghaltak.test", gateway: gw.client });
    const { authority } = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    const ret = () => handleSubscriptionReturn({ attemptId, authority, status: "OK" }, { gateway: gw.client });
    return { attemptId, authority, ret };
  }

  it("a trial store pays for BASIC: invoice paid, a Jalali month from now, amount from plans.ts", async () => {
    const id = await store("TRIAL", new Date(Date.now() + 5 * DAY));
    const before = Date.now();
    const { ret } = await pay(id, "BASIC");
    expect(gw.requestAmounts).toEqual([400_000]);
    expect(await ret()).toBe("paid");

    const s = await sub(id);
    expect(s.plan).toBe("BASIC");
    expect(s.status).toBe("ACTIVE");
    const expected = addJalaliMonth(new Date(before)).getTime();
    expect(Math.abs(s.currentPeriodEnd.getTime() - expected)).toBeLessThan(60_000);
    const inv = await prisma.invoice.findFirstOrThrow({ where: { sellerId: id } });
    expect(inv).toMatchObject({ status: "PAID", plan: "BASIC", amount: 400_000 });
  });

  it("a repeated return, even at the same moment, extends the period only once", async () => {
    const id = await store("FREE", new Date());
    const { ret } = await pay(id, "PRO");
    const results = await Promise.all([ret(), ret(), ret()]);
    expect(results).toEqual(["paid", "paid", "paid"]);
    const once = (await sub(id)).currentPeriodEnd;
    expect(once.getTime()).toBeLessThan(Date.now() + 32 * DAY); // one month, not three
    const verifies = gw.verifyCalls.length; // simultaneous returns may each verify: harmless
    expect(await ret()).toBe("paid");
    expect((await sub(id)).currentPeriodEnd).toEqual(once);
    expect(gw.verifyCalls).toHaveLength(verifies); // a later return doesn't even ask the gateway
    expect(await prisma.invoice.count({ where: { sellerId: id, status: "PAID" } })).toBe(1);
  });

  it("a wrong amount at the gateway extends nothing", async () => {
    const end = new Date(Date.now() + 3 * DAY);
    const id = await store("BASIC", end);
    gw.verifyResult = { ok: false, amountMismatch: true, transient: false, detail: "-50" };
    const { ret } = await pay(id, "BASIC");
    expect(await ret()).toBe("mismatch");
    expect((await sub(id)).currentPeriodEnd).toEqual(end);
    expect((await prisma.invoice.findFirstOrThrow({ where: { sellerId: id } })).status).toBe("OPEN");
  });

  it("verifies with OUR amount, never one from the callback", async () => {
    const id = await store("FREE", new Date());
    const { ret } = await pay(id, "GROWTH");
    await ret();
    expect(gw.verifyCalls[0].amount).toBe(1_100_000);
  });

  it("early renewal during a paid period starts at its end: no days lost", async () => {
    const end = new Date(Date.now() + 3 * DAY);
    const id = await store("BASIC", end);
    const { ret } = await pay(id, "BASIC");
    expect(await ret()).toBe("paid");
    const s = await sub(id);
    expect(s.currentPeriodEnd).toEqual(addJalaliMonth(end));
    expect(s.nextPlan).toBeNull();
  });

  it("a plan change during a paid period starts when the period ends", async () => {
    const end = new Date(Date.now() + 3 * DAY);
    const id = await store("BASIC", end);
    const { ret } = await pay(id, "PRO");
    expect(await ret()).toBe("paid");
    const s = await sub(id);
    expect(s).toMatchObject({ plan: "BASIC", nextPlan: "PRO", nextPlanFrom: end, currentPeriodEnd: addJalaliMonth(end) });

    // A third plan can't be bought while that change waits.
    await expect(startSubscriptionPayment(id, "GROWTH", { origin: "https://x.test", gateway: gw.client })).rejects.toThrow(
      SubscriptionPaymentError,
    );
  });

  it("after the grace period a payment starts a new month from now", async () => {
    const id = await store("PRO", new Date(Date.now() - 10 * DAY));
    const before = Date.now();
    const { ret } = await pay(id, "BASIC");
    expect(await ret()).toBe("paid");
    const s = await sub(id);
    expect(s.plan).toBe("BASIC");
    expect(s.currentPeriodEnd.getTime()).toBeGreaterThanOrEqual(addJalaliMonth(new Date(before)).getTime() - 1000);
  });

  it("canceled at the gateway changes nothing; a gateway outage stays pending and a refresh finishes it", async () => {
    const id = await store("FREE", new Date());
    const first = await pay(id, "BASIC");
    expect(await handleSubscriptionReturn({ attemptId: first.attemptId, authority: first.authority, status: "NOK" }, { gateway: gw.client })).toBe("canceled");
    expect((await sub(id)).plan).toBe("FREE");

    const second = await pay(id, "BASIC");
    gw.verifyResult = { ok: false, amountMismatch: false, transient: true, detail: "timeout" };
    expect(await second.ret()).toBe("pending");
    gw.verifyResult = { ok: true, refId: "REF-2", cardPanMasked: null, alreadyVerified: false };
    expect(await second.ret()).toBe("paid");
    expect((await sub(id)).plan).toBe("BASIC");
  });

  it("a forged return (wrong authority) or an unknown attempt changes nothing", async () => {
    const id = await store("FREE", new Date());
    const { attemptId } = await pay(id, "BASIC");
    expect(await handleSubscriptionReturn({ attemptId, authority: "FORGED", status: "OK" }, { gateway: gw.client })).toBe("invalid");
    expect(await handleSubscriptionReturn({ attemptId: "nope", authority: "x", status: "OK" }, { gateway: gw.client })).toBe("invalid");
    expect((await sub(id)).plan).toBe("FREE");
  });

  it("a double click reuses the open payment instead of a second invoice", async () => {
    const id = await store("FREE", new Date());
    const a = await startSubscriptionPayment(id, "BASIC", { origin: "https://x.test", gateway: gw.client });
    const b = await startSubscriptionPayment(id, "BASIC", { origin: "https://x.test", gateway: gw.client });
    expect(b.attemptId).toBe(a.attemptId);
    expect(await prisma.invoice.count({ where: { sellerId: id } })).toBe(1);
  });

  it("with billing off there is no way to pay", async () => {
    process.env.BILLING_ENABLED = "false";
    const id = await store("TRIAL", new Date(Date.now() + DAY));
    await expect(startSubscriptionPayment(id, "BASIC", { origin: "https://x.test", gateway: gw.client })).rejects.toThrow(
      SubscriptionPaymentError,
    );
  });

  it("a payment the seller never came back from is verified later, once it is old enough", async () => {
    const id = await store("FREE", new Date());
    const { attemptId } = await pay(id, "BASIC");
    // Still fresh: the seller may be on the gateway page right now.
    expect(await retryStalePendingPayments(id, { gateway: gw.client })).toBe(0);
    await prisma.paymentAttempt.update({ where: { id: attemptId }, data: { createdAt: new Date(Date.now() - 40 * 60 * 1000) } });
    expect(await retryStalePendingPayments(id, { gateway: gw.client })).toBe(1);
    expect((await sub(id)).plan).toBe("BASIC");
  });
});
