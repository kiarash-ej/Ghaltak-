import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hasTestDatabase } from "@/test/setup";
import { StatusError, changeOrderStatus } from "./status-change";

// Generic status changes against a real Postgres: what happens to a receipt
// when an order is canceled (B3 review).

describe.skipIf(!hasTestDatabase)("changeOrderStatus (database)", () => {
  const runId = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  let sellerId = "";
  let customerId = "";

  beforeAll(async () => {
    sellerId = (await prisma.seller.create({ data: { name: "فروشگاه", mobile: `0989${runId}` } })).id;
    customerId = (await prisma.customer.create({ data: { sellerId, name: "مشتری", phone: "09350000002" } })).id;
  });
  afterAll(async () => {
    await prisma.order.deleteMany({ where: { sellerId } });
    await prisma.customer.deleteMany({ where: { sellerId } });
    await prisma.seller.delete({ where: { id: sellerId } });
    await prisma.$disconnect();
  });

  const order = (data: { status?: "PENDING_PAYMENT" | "PAID"; receiptImageUrl?: string | null; paidAt?: Date }) =>
    prisma.order.create({ data: { sellerId, customerId, totalPrice: 50_000, ...data } });
  const read = (id: string) => prisma.order.findUniqueOrThrow({ where: { id } });

  it("canceling an unpaid order removes the customer's receipt", async () => {
    const o = await order({ receiptImageUrl: "receipts/unpaid.png" });
    await changeOrderStatus(sellerId, o.id, "CANCELED");
    expect(await read(o.id)).toMatchObject({ status: "CANCELED", receiptImageUrl: null });
  });

  it("canceling a paid order keeps its receipt, the record of the payment", async () => {
    const o = await order({ status: "PAID", paidAt: new Date(), receiptImageUrl: "receipts/paid.png" });
    await changeOrderStatus(sellerId, o.id, "CANCELED");
    expect(await read(o.id)).toMatchObject({ status: "CANCELED", receiptImageUrl: "receipts/paid.png" });
  });

  it("refuses a move the rules don't allow, and another seller's order", async () => {
    const o = await order({});
    await expect(changeOrderStatus(sellerId, o.id, "SHIPPED")).rejects.toThrow(StatusError);
    await expect(changeOrderStatus("someone-else", o.id, "CANCELED")).rejects.toThrow("سفارش پیدا نشد.");
    expect((await read(o.id)).status).toBe("PENDING_PAYMENT");
  });
});
