import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { hasTestDatabase } from "@/test/setup";
import { prisma } from "@/lib/prisma";
import { expireUnpaidLinkOrders } from "@/server/orders/expire-orders";
import { listOrders } from "@/server/orders/queries";
import { OnlinePaymentError, handleGatewayReturn, startOnlinePayment } from "./online-payment";
import type { PaymentGateway } from "./types";

// Online payment edge cases against a real Postgres (docs/phase2/TRACK-B.md,
// B6): double return, wrong amount, expiry during payment, late payment,
// gateway outage, a verified payment that fails to apply, double click.

type VerifyResult = Awaited<ReturnType<PaymentGateway["verify"]>>;
type Scripted = {
  verifyResult: VerifyResult;
  verifyCalls: { authority: string; amount: number }[];
  requestCount: () => number;
  client: PaymentGateway;
};

/** A scripted gateway: records requests, verifies with whatever the test says. */
function scriptedGateway(): Scripted {
  const verifyCalls: { authority: string; amount: number }[] = [];
  let n = 0;
  const gw: Scripted = {
    verifyResult: { ok: true, refId: "REF-1", cardPanMasked: "6037-99**-****-1234", alreadyVerified: false },
    verifyCalls,
    requestCount: () => n,
    client: {
      provider: "ZARINPAL" as const,
      async request() {
        n += 1;
        const authority = `TEST-AUTH-${Date.now()}-${n}`;
        return { ok: true as const, authority, redirectUrl: `https://gateway.test/pay/${authority}` };
      },
      payUrl: (authority: string) => `https://gateway.test/pay/${authority}`,
      async verify(input: { authority: string; amount: number }) {
        verifyCalls.push(input);
        return gw.verifyResult;
      },
    },
  };
  return gw;
}

describe.skipIf(!hasTestDatabase)("online payment (database)", () => {
  const runId = String(Date.now()).slice(-7);
  let sellerId = "";
  let customerId = "";
  let productId = "";
  let gw: ReturnType<typeof scriptedGateway>;
  const gatewayFor = async () => gw.client;

  async function newOrder(opts: { shippingCost?: number; createdAt?: Date; source?: "MANUAL" | "PURCHASE_LINK" } = {}) {
    return prisma.order.create({
      data: {
        sellerId,
        customerId,
        source: opts.source ?? "MANUAL",
        totalPrice: 100_000,
        shippingCost: opts.shippingCost ?? 20_000,
        publicToken: `tok-${runId}-${Math.random().toString(36).slice(2, 12)}-xx`,
        ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
        items: { create: { productId, quantity: 1, unitPrice: 100_000 } },
      },
    });
  }

  async function startAndGetAuthority(publicToken: string) {
    const { attemptId } = await startOnlinePayment(publicToken, { origin: "https://ghaltak.test", gatewayFor });
    const a = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    return { attemptId, authority: a.authority! };
  }

  beforeAll(async () => {
    sellerId = (await prisma.seller.create({ data: { name: "online pay", mobile: `0998${runId}` } })).id;
    customerId = (await prisma.customer.create({ data: { sellerId, phone: `0939${runId}` } })).id;
    productId = (await prisma.product.create({ data: { sellerId, name: "p", price: 100_000 } })).id;
  });
  beforeEach(() => {
    gw = scriptedGateway();
  });
  afterAll(async () => {
    if (!sellerId) return;
    await prisma.paymentAttempt.deleteMany({ where: { sellerId } });
    await prisma.order.deleteMany({ where: { sellerId } });
    await prisma.customer.deleteMany({ where: { sellerId } });
    await prisma.product.deleteMany({ where: { sellerId } });
    await prisma.seller.delete({ where: { id: sellerId } });
    await prisma.$disconnect();
  });

  it("starts a payment for amountDue (items + shipping) with a callback to the attempt", async () => {
    const order = await newOrder();
    const { attemptId, authority } = await startAndGetAuthority(order.publicToken!);
    const a = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    expect(a).toMatchObject({ status: "PENDING", amount: 120_000, orderId: order.id, sellerId });
    expect(authority).toMatch(/^TEST-AUTH-/);
  });

  it("pays the order once, even when the gateway sends the customer back twice", async () => {
    const order = await newOrder();
    const { attemptId, authority } = await startAndGetAuthority(order.publicToken!);

    const first = await handleGatewayReturn({ attemptId, authority, status: "OK" }, { gatewayFor });
    const second = await handleGatewayReturn({ attemptId, authority, status: "OK" }, { gatewayFor });
    expect(first.outcome).toBe("paid");
    expect(second.outcome).toBe("paid");
    expect(gw.verifyCalls).toEqual([{ authority, amount: 120_000 }]); // verified with OUR amount, once

    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o).toMatchObject({ status: "PAID", paymentMethod: "ONLINE" });
    const a = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    expect(a).toMatchObject({ status: "VERIFIED", refId: "REF-1", cardPanMasked: "6037-99**-****-1234" });
  });

  it("pays once when two returns race", async () => {
    const order = await newOrder();
    const { attemptId, authority } = await startAndGetAuthority(order.publicToken!);
    const results = await Promise.all([
      handleGatewayReturn({ attemptId, authority, status: "OK" }, { gatewayFor }),
      handleGatewayReturn({ attemptId, authority, status: "OK" }, { gatewayFor }),
    ]);
    expect(results.map((r) => r.outcome)).toEqual(["paid", "paid"]);
    expect(await prisma.paymentAttempt.count({ where: { orderId: order.id, status: "VERIFIED" } })).toBe(1);
  });

  it("records a cancel at the gateway and leaves the order waiting", async () => {
    const order = await newOrder();
    const { attemptId, authority } = await startAndGetAuthority(order.publicToken!);
    expect((await handleGatewayReturn({ attemptId, authority, status: "NOK" }, { gatewayFor })).outcome).toBe("canceled");
    expect(gw.verifyCalls).toEqual([]);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING_PAYMENT");
    expect(await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } })).toMatchObject({
      status: "CANCELED",
      failureReason: "CANCELED_BY_USER",
    });
  });

  it("ignores a return whose authority isn't the attempt's", async () => {
    const order = await newOrder();
    const { attemptId } = await startAndGetAuthority(order.publicToken!);
    const r = await handleGatewayReturn({ attemptId, authority: "SOMEONE-ELSES", status: "OK" }, { gatewayFor });
    expect(r.outcome).toBe("invalid");
    expect(r.publicToken).toBeNull(); // the attempt id alone never leads to the order page (#49)
    expect(gw.verifyCalls).toEqual([]);
    expect((await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } })).status).toBe("PENDING");

    const none = await handleGatewayReturn({ attemptId, authority: null, status: "OK" }, { gatewayFor });
    expect(none).toEqual({ outcome: "invalid", publicToken: null, orderId: null });
  });

  it("a settled payment's return needs its Authority too, before showing the order (#49)", async () => {
    const order = await newOrder();
    const { attemptId, authority } = await startAndGetAuthority(order.publicToken!);
    expect((await handleGatewayReturn({ attemptId, authority, status: "OK" }, { gatewayFor })).outcome).toBe("paid");

    for (const wrong of [null, "SOMEONE-ELSES"]) {
      const r = await handleGatewayReturn({ attemptId, authority: wrong, status: "OK" }, { gatewayFor });
      expect(r).toEqual({ outcome: "invalid", publicToken: null, orderId: null });
    }
    const again = await handleGatewayReturn({ attemptId, authority, status: "OK" }, { gatewayFor });
    expect(again).toMatchObject({ outcome: "paid", publicToken: order.publicToken });
  });

  it("does not pay the order when the gateway reports a different amount", async () => {
    const order = await newOrder();
    const { attemptId, authority } = await startAndGetAuthority(order.publicToken!);
    gw.verifyResult = { ok: false, amountMismatch: true, transient: false, detail: "code -50" };
    expect((await handleGatewayReturn({ attemptId, authority, status: "OK" }, { gatewayFor })).outcome).toBe("mismatch");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING_PAYMENT");
    expect(await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } })).toMatchObject({
      status: "FAILED",
      failureReason: "AMOUNT_MISMATCH",
      failureDetail: "code -50",
    });
  });

  it("does not pay the order when its amount changed during payment, and flags it", async () => {
    const order = await newOrder();
    const { attemptId, authority } = await startAndGetAuthority(order.publicToken!);
    await prisma.order.update({ where: { id: order.id }, data: { shippingCost: 40_000 } });
    expect((await handleGatewayReturn({ attemptId, authority, status: "OK" }, { gatewayFor })).outcome).toBe("mismatch");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING_PAYMENT");
    expect(await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } })).toMatchObject({
      status: "VERIFIED",
      failureReason: "AMOUNT_MISMATCH",
      failureDetail: "ORDER_AMOUNT_CHANGED",
    });
  });

  it("does not reopen an order canceled before the payment arrived (late payment)", async () => {
    const order = await newOrder();
    const { attemptId, authority } = await startAndGetAuthority(order.publicToken!);
    await prisma.order.update({ where: { id: order.id }, data: { status: "CANCELED" } });
    expect((await handleGatewayReturn({ attemptId, authority, status: "OK" }, { gatewayFor })).outcome).toBe("late");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("CANCELED");
    // Say what happened, not a guess: this order was canceled, not expired.
    expect(await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } })).toMatchObject({
      status: "VERIFIED",
      failureReason: null,
      failureDetail: "ORDER_WAS_CANCELED",
    });
  });

  it("flags a payment for an order that was already paid (double payment, to refund)", async () => {
    const order = await newOrder();
    const { attemptId, authority } = await startAndGetAuthority(order.publicToken!);
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "PAID", paymentMethod: "CARD_TO_CARD", paidAt: new Date() },
    });
    expect((await handleGatewayReturn({ attemptId, authority, status: "OK" }, { gatewayFor })).outcome).toBe("late");
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      status: "PAID",
      paymentMethod: "CARD_TO_CARD",
    });
    expect(await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } })).toMatchObject({
      status: "VERIFIED",
      failureDetail: "ORDER_WAS_PAID",
    });
  });

  it("keeps the attempt open when the gateway can't be reached, and pays on the next return", async () => {
    const order = await newOrder();
    const { attemptId, authority } = await startAndGetAuthority(order.publicToken!);
    gw.verifyResult = { ok: false, amountMismatch: false, transient: true, detail: "TimeoutError" };
    expect((await handleGatewayReturn({ attemptId, authority, status: "OK" }, { gatewayFor })).outcome).toBe("pending");
    expect((await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } })).status).toBe("PENDING");

    gw.verifyResult = { ok: true, refId: "REF-2", cardPanMasked: null, alreadyVerified: true };
    expect((await handleGatewayReturn({ attemptId, authority, status: "OK" }, { gatewayFor })).outcome).toBe("paid");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PAID");
  });

  it("keeps a verified payment on record when applying it fails, and finishes it later", async () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const order = await newOrder({ source: "PURCHASE_LINK", createdAt: threeDaysAgo });
    const { attemptId, authority } = await startAndGetAuthority(order.publicToken!);

    // The first now() stamps verifiedAt; the second (paidAt, inside the apply
    // transaction) fails, like the database dropping out at that moment.
    let calls = 0;
    const flakyNow = () => {
      calls += 1;
      if (calls === 2) throw new Error("connection lost");
      return new Date();
    };
    const logged: object[] = [];
    const r = await handleGatewayReturn(
      { attemptId, authority, status: "OK" },
      { gatewayFor, now: flakyNow, log: (_msg, data) => logged.push(data) },
    );
    expect(r).toMatchObject({ outcome: "pending", publicToken: order.publicToken, orderId: order.id });
    expect(logged).toEqual([expect.objectContaining({ attemptId, name: "Error" })]);
    expect(logged[0]).not.toHaveProperty("message"); // the error's text is never logged (#50)

    const a = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    expect(a).toMatchObject({ status: "VERIFIED", refId: "REF-1", failureDetail: "NOT_APPLIED" });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING_PAYMENT");

    // The seller sees it, and it is not expired even long after the grace period.
    const { items } = await listOrders(sellerId, {});
    expect(items.find((o) => o.id === order.id)?.onlinePaymentNeedsReview).toBe(true);
    await expireUnpaidLinkOrders(sellerId, new Date(Date.now() + 24 * 60 * 60 * 1000));
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING_PAYMENT");

    // A refresh (another return) applies it, without asking the gateway again.
    expect((await handleGatewayReturn({ attemptId, authority, status: "OK" }, { gatewayFor })).outcome).toBe("paid");
    expect(gw.verifyCalls).toHaveLength(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PAID");
    expect((await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } })).failureDetail).toBeNull();
  });

  it("reopens the same payment page on a second click instead of creating another", async () => {
    const order = await newOrder();
    const first = await startOnlinePayment(order.publicToken!, { origin: "https://ghaltak.test", gatewayFor });
    const second = await startOnlinePayment(order.publicToken!, { origin: "https://ghaltak.test", gatewayFor });
    expect(second).toEqual(first);
    expect(gw.requestCount()).toBe(1);
    expect(await prisma.paymentAttempt.count({ where: { orderId: order.id } })).toBe(1);

    // A different amount is a different payment: a new attempt.
    await prisma.order.update({ where: { id: order.id }, data: { shippingCost: 30_000 } });
    const third = await startOnlinePayment(order.publicToken!, { origin: "https://ghaltak.test", gatewayFor });
    expect(third.attemptId).not.toBe(first.attemptId);
    expect((await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: third.attemptId } })).amount).toBe(130_000);
  });

  it("creates one payment page when two clicks arrive together", async () => {
    const order = await newOrder();
    const results = await Promise.allSettled([
      startOnlinePayment(order.publicToken!, { origin: "https://ghaltak.test", gatewayFor }),
      startOnlinePayment(order.publicToken!, { origin: "https://ghaltak.test", gatewayFor }),
    ]);
    expect(results.some((r) => r.status === "fulfilled")).toBe(true);
    for (const r of results) {
      if (r.status === "rejected") expect(r.reason).toBeInstanceOf(OnlinePaymentError);
    }
    expect(await prisma.paymentAttempt.count({ where: { orderId: order.id } })).toBe(1);
    expect(gw.requestCount()).toBe(1);
  });

  it("does not expire an order while its online payment is in progress", async () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const paying = await newOrder({ source: "PURCHASE_LINK", createdAt: threeDaysAgo });
    const abandoned = await newOrder({ source: "PURCHASE_LINK", createdAt: threeDaysAgo });
    await startAndGetAuthority(paying.publicToken!);

    await expireUnpaidLinkOrders(sellerId);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: paying.id } })).status).toBe("PENDING_PAYMENT");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: abandoned.id } })).status).toBe("CANCELED");

    // Once the attempt is older than the grace period, the order expires too.
    await expireUnpaidLinkOrders(sellerId, new Date(Date.now() + 31 * 60 * 1000));
    expect((await prisma.order.findUniqueOrThrow({ where: { id: paying.id } })).status).toBe("CANCELED");
  });

  it("refuses to start for a paid order, or when the seller has no active gateway", async () => {
    const order = await newOrder();
    await prisma.order.update({ where: { id: order.id }, data: { status: "PAID", paidAt: new Date() } });
    await expect(
      startOnlinePayment(order.publicToken!, { origin: "https://x", gatewayFor }),
    ).rejects.toBeInstanceOf(OnlinePaymentError);

    const other = await newOrder();
    await expect(
      startOnlinePayment(other.publicToken!, { origin: "https://x", gatewayFor: async () => null }),
    ).rejects.toThrow(/فعال نیست/);
    expect(await prisma.paymentAttempt.count({ where: { orderId: other.id } })).toBe(0);
  });
});
