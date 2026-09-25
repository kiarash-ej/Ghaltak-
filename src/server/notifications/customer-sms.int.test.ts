import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { hasTestDatabase } from "@/test/setup";
import { prisma } from "@/lib/prisma";
import type { SendSms, SendSmsInput } from "@/server/sms/types";
import { notifyCustomer, remindUnpaidOrders } from "./customer-sms";

// Customer SMS (B7) against a real Postgres (TEST_DATABASE_URL), through the
// real sendSms. Without Kavenegar keys it records DEV rows and sends nothing.

const ORIGIN = "https://ghaltak.test";

describe.skipIf(!hasTestDatabase)("customer SMS (database)", () => {
  const runId = String(Date.now()).slice(-7);
  let sellerId = "";
  let customerId = "";
  let productId = "";

  async function newOrder(opts: { source?: "MANUAL" | "PURCHASE_LINK"; ageHours?: number; receipt?: boolean } = {}) {
    return prisma.order.create({
      data: {
        sellerId,
        customerId,
        source: opts.source ?? "MANUAL",
        totalPrice: 50_000,
        publicToken: `sms-${runId}-${Math.random().toString(36).slice(2, 12)}-x`,
        trackingCode: "9876543210",
        receiptImageUrl: opts.receipt ? "receipts/00000000-0000-0000-0000-000000000000.png" : null,
        ...(opts.ageHours ? { createdAt: new Date(Date.now() - opts.ageHours * 60 * 60 * 1000) } : {}),
        items: { create: { productId, quantity: 1, unitPrice: 50_000 } },
      },
    });
  }
  const rowsFor = (orderId: string) => prisma.smsMessage.findMany({ where: { orderId } });

  beforeAll(async () => {
    sellerId = (await prisma.seller.create({ data: { name: "sms", mobile: `0994${runId}` } })).id;
    customerId = (await prisma.customer.create({ data: { sellerId, phone: `0917${runId}` } })).id;
    productId = (await prisma.product.create({ data: { sellerId, name: "p", price: 50_000 } })).id;
  });
  beforeEach(async () => {
    await prisma.seller.update({
      where: { id: sellerId },
      data: { smsOnOrderPlaced: true, smsOnPaid: true, smsOnShipped: true },
    });
  });
  afterAll(async () => {
    if (!sellerId) return;
    await prisma.smsMessage.deleteMany({ where: { sellerId } });
    await prisma.order.deleteMany({ where: { sellerId } });
    await prisma.customer.deleteMany({ where: { sellerId } });
    await prisma.product.deleteMany({ where: { sellerId } });
    await prisma.seller.delete({ where: { id: sellerId } });
    await prisma.$disconnect();
  });

  it("texts each order event once, however often it is triggered", async () => {
    const order = await newOrder();
    const first = await notifyCustomer("ORDER_PAID", order.id, { origin: ORIGIN });
    const again = await notifyCustomer("ORDER_PAID", order.id, { origin: ORIGIN });
    expect(first).toEqual({ ok: true, status: "DEV" });
    expect(again).toEqual({ ok: true, status: "DUPLICATE" });
    const rows = await rowsFor(order.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "ORDER_PAID", status: "DEV", sellerId, to: `0917${runId}` });
  });

  it("sends the order code, the customer's order link and the tracking code", async () => {
    const order = await newOrder();
    const sent: SendSmsInput[] = [];
    const send: SendSms = async (input) => {
      sent.push(input);
      return { ok: true, status: "SENT" };
    };
    await notifyCustomer("ORDER_SHIPPED", order.id, { origin: ORIGIN, send });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ kind: "ORDER_SHIPPED", orderId: order.id, to: `0917${runId}` });
    expect(sent[0].tokens).toEqual([
      order.id.slice(-6).toUpperCase(),
      "9876543210",
      `${ORIGIN}/buy/order/${order.publicToken}`,
    ]);
  });

  it("sends nothing when the seller switched the event off", async () => {
    const order = await newOrder();
    await prisma.seller.update({ where: { id: sellerId }, data: { smsOnShipped: false } });
    expect(await notifyCustomer("ORDER_SHIPPED", order.id, { origin: ORIGIN })).toEqual({
      ok: false,
      reason: "SWITCHED_OFF",
    });
    expect(await rowsFor(order.id)).toHaveLength(0);
  });

  it("sends nothing over the plan's quota, and doesn't fail", async () => {
    const order = await newOrder();
    const r = await notifyCustomer("ORDER_PLACED", order.id, { origin: ORIGIN, canUse: async () => false });
    expect(r).toEqual({ ok: false, reason: "QUOTA" });
    expect(await rowsFor(order.id)).toHaveLength(0);
  });

  it("never throws, even if the SMS service does", async () => {
    const order = await newOrder();
    const r = await notifyCustomer("ORDER_PLACED", order.id, {
      origin: ORIGIN,
      send: async () => {
        throw new Error("boom");
      },
    });
    expect(r).toEqual({ ok: false, reason: "ERROR" });
  });

  it("reminds unpaid purchase-link orders 24 hours before expiry, once", async () => {
    const due = await newOrder({ source: "PURCHASE_LINK", ageHours: 30 });
    const tooNew = await newOrder({ source: "PURCHASE_LINK", ageHours: 10 });
    const manual = await newOrder({ source: "MANUAL", ageHours: 30 });
    const withReceipt = await newOrder({ source: "PURCHASE_LINK", ageHours: 30, receipt: true });
    const expired = await newOrder({ source: "PURCHASE_LINK", ageHours: 50 });

    expect(await remindUnpaidOrders(sellerId, { origin: ORIGIN })).toBe(1);
    expect(await remindUnpaidOrders(sellerId, { origin: ORIGIN })).toBe(0);

    expect(await rowsFor(due.id)).toMatchObject([{ kind: "PAYMENT_REMINDER" }]);
    for (const o of [tooNew, manual, withReceipt, expired]) expect(await rowsFor(o.id)).toHaveLength(0);
  });
});
