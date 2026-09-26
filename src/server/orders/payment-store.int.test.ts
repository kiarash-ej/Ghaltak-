import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hasTestDatabase } from "@/test/setup";
import { PaymentError, confirmPaymentInTx } from "./payment-store";

// Manual payment confirmation against a real Postgres (phase 1 B3): the single
// way an order becomes PAID, and the receipt the seller saw.

describe.skipIf(!hasTestDatabase)("confirmPaymentInTx (database)", () => {
  const runId = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  let sellerId = "";
  let otherSellerId = "";
  let customerId = "";

  beforeAll(async () => {
    const seller = await prisma.seller.create({ data: { name: "فروشگاه", mobile: `0990${runId}` } });
    const other = await prisma.seller.create({ data: { name: "دیگری", mobile: `0990${runId.slice(1)}9` } });
    sellerId = seller.id;
    otherSellerId = other.id;
    customerId = (await prisma.customer.create({ data: { sellerId, name: "مشتری", phone: "09350000001" } })).id;
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { sellerId: { in: [sellerId, otherSellerId] } } });
    await prisma.customer.deleteMany({ where: { sellerId } });
    await prisma.seller.deleteMany({ where: { id: { in: [sellerId, otherSellerId] } } });
    await prisma.$disconnect();
  });

  const newOrder = (data: { receiptImageUrl?: string | null; status?: "PENDING_PAYMENT" | "CANCELED" } = {}) =>
    prisma.order.create({ data: { sellerId, customerId, totalPrice: 100_000, ...data } });

  const confirm = (orderId: string, extra: { expectedReceiptKey?: string | null; receiptKey?: string; seller?: string } = {}) =>
    prisma.$transaction((tx) =>
      confirmPaymentInTx(tx, {
        sellerId: extra.seller ?? sellerId,
        orderId,
        method: "CARD_TO_CARD",
        paidAt: new Date(),
        receiptKey: extra.receiptKey,
        expectedReceiptKey: extra.expectedReceiptKey,
      }),
    );

  it("moves a waiting order to PAID once, with method and time", async () => {
    const order = await newOrder();
    await confirm(order.id, { expectedReceiptKey: null });
    const paid = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(paid).toMatchObject({ status: "PAID", paymentMethod: "CARD_TO_CARD" });
    expect(paid.paidAt).not.toBeNull();
    await expect(confirm(order.id, { expectedReceiptKey: null })).rejects.toThrow(PaymentError);
  });

  it("confirms on the receipt the seller saw", async () => {
    const order = await newOrder({ receiptImageUrl: "receipts/a.png" });
    await confirm(order.id, { expectedReceiptKey: "receipts/a.png" });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PAID");
  });

  it("refuses when the customer sent a new receipt since the seller looked", async () => {
    const swapped = await newOrder({ receiptImageUrl: "receipts/b.png" });
    await expect(confirm(swapped.id, { expectedReceiptKey: "receipts/a.png" })).rejects.toThrow(/رسید تازه/);

    // A receipt arrived after the seller opened an order that had none.
    const arrived = await newOrder({ receiptImageUrl: "receipts/c.png" });
    await expect(confirm(arrived.id, { expectedReceiptKey: null })).rejects.toThrow(/رسید تازه/);

    for (const id of [swapped.id, arrived.id]) {
      expect((await prisma.order.findUniqueOrThrow({ where: { id } })).status).toBe("PENDING_PAYMENT");
    }
  });

  it("a verified gateway payment (no expected receipt) is not held up by a receipt", async () => {
    const order = await newOrder({ receiptImageUrl: "receipts/d.png" });
    await confirm(order.id);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PAID");
  });

  it("the seller's own receipt replaces the customer's and reports the old one for deletion", async () => {
    const order = await newOrder({ receiptImageUrl: "receipts/e.png" });
    const r = await confirm(order.id, { expectedReceiptKey: "receipts/e.png", receiptKey: "receipts/f.png" });
    expect(r.previousReceiptKey).toBe("receipts/e.png");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).receiptImageUrl).toBe("receipts/f.png");
  });

  it("never pays a canceled order or another seller's order", async () => {
    const canceled = await newOrder({ status: "CANCELED" });
    await expect(confirm(canceled.id)).rejects.toThrow(PaymentError);
    const mine = await newOrder();
    await expect(confirm(mine.id, { seller: otherSellerId })).rejects.toThrow("سفارش پیدا نشد.");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: mine.id } })).status).toBe("PENDING_PAYMENT");
  });
});
