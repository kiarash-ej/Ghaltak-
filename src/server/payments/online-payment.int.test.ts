import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { hasTestDatabase } from "@/test/setup";
import { prisma } from "@/lib/prisma";
import { expireUnpaidLinkOrders } from "@/server/orders/expire-orders";
import { OnlinePaymentError, handleGatewayReturn, startOnlinePayment } from "./online-payment";
import type { PaymentGateway } from "./types";

// Online payment edge cases against a real Postgres (docs/phase2/TRACK-B.md,
// B6): double return, wrong amount, expiry during payment, late payment.

type VerifyResult = Awaited<ReturnType<PaymentGateway["verify"]>>;
type Scripted = {
  verifyResult: VerifyResult;
  verifyCalls: { authority: string; amount: number }[];
  client: PaymentGateway;
};

/** A scripted gateway: records requests, verifies with whatever the test says. */
function scriptedGateway(): Scripted {
  const verifyCalls: { authority: string; amount: number }[] = [];
  let n = 0;
  const gw: Scripted = {
    verifyResult: { ok: true, refId: "REF-1", cardPanMasked: "6037-99**-****-1234", alreadyVerified: false },
    verifyCalls,
    client: {
      provider: "ZARINPAL" as const,
      async request() {
        n += 1;
        return { ok: true as const, authority: `TEST-AUTH-${Date.now()}-${n}`, redirectUrl: "https://gateway.test/pay" };
      },
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
    expect(gw.verifyCalls).toEqual([]);
    expect((await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } })).status).toBe("PENDING");
  });

  it("does not pay the order when the gateway reports a different amount", async () => {
    const order = await newOrder();
    const { attemptId, authority } = await startAndGetAuthority(order.publicToken!);
    gw.verifyResult = { ok: false, amountMismatch: true, detail: "code -50" };
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
    const a = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    expect(a).toMatchObject({ status: "VERIFIED", failureReason: "AMOUNT_MISMATCH" });
    expect(a.failureDetail).not.toBeNull();
  });

  it("does not reopen an order canceled before the payment arrived (late payment)", async () => {
    const order = await newOrder();
    const { attemptId, authority } = await startAndGetAuthority(order.publicToken!);
    await prisma.order.update({ where: { id: order.id }, data: { status: "CANCELED" } });
    expect((await handleGatewayReturn({ attemptId, authority, status: "OK" }, { gatewayFor })).outcome).toBe("late");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("CANCELED");
    expect(await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } })).toMatchObject({
      status: "VERIFIED",
      failureReason: "EXPIRED",
    });
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
