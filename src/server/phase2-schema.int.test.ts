import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hasTestDatabase } from "@/test/setup";

// What the Phase 2 schema guarantees to A8 (order SMS) and B6 (online
// payment), fixed in Step 0 so neither needs a schema change mid-phase.
// Runs against a real Postgres (TEST_DATABASE_URL). See docs/phase1/README.md.
describe.skipIf(!hasTestDatabase)("Phase 2 schema contracts (database)", () => {
  const mobile = `0994${String(Date.now()).slice(-7)}`;
  let sellerId = "";
  let orderId = "";

  beforeAll(async () => {
    const seller = await prisma.seller.create({ data: { mobile, name: "آزمایش اسکیما" } });
    sellerId = seller.id;
    const customer = await prisma.customer.create({ data: { sellerId, phone: "09350000001" } });
    orderId = (await prisma.order.create({ data: { sellerId, customerId: customer.id, totalPrice: 100_000 } })).id;
  });

  afterAll(async () => {
    await prisma.paymentAttempt.deleteMany({ where: { sellerId } });
    await prisma.smsMessage.deleteMany({ where: { sellerId } });
    await prisma.order.deleteMany({ where: { sellerId } });
    await prisma.customer.deleteMany({ where: { sellerId } });
    await prisma.seller.deleteMany({ where: { id: sellerId } });
    await prisma.$disconnect();
  });

  describe("order SMS: claim first, then send", () => {
    const claim = () =>
      prisma.smsMessage.createMany({
        data: [{ sellerId, to: "09350000001", kind: "ORDER_PAID", orderId, status: "PENDING" }],
        skipDuplicates: true,
      });

    it("exactly one of several simultaneous claims wins", async () => {
      const results = await Promise.all([claim(), claim(), claim(), claim()]);
      expect(results.map((r) => r.count).sort()).toEqual([0, 0, 0, 1]);
      expect(await prisma.smsMessage.count({ where: { orderId, kind: "ORDER_PAID" } })).toBe(1);
    });

    it("a FAILED message can be claimed again for a retry, once", async () => {
      const where = { orderId, kind: "ORDER_PAID" as const };
      await prisma.smsMessage.updateMany({ where, data: { status: "FAILED", attempts: { increment: 1 } } });

      const retry = () =>
        prisma.smsMessage.updateMany({ where: { ...where, status: "FAILED" }, data: { status: "PENDING" } });
      const results = await Promise.all([retry(), retry()]);
      expect(results.map((r) => r.count).sort()).toEqual([0, 1]);

      const row = await prisma.smsMessage.findFirstOrThrow({ where });
      expect(row).toMatchObject({ status: "PENDING", attempts: 1 });
      expect(row.updatedAt.getTime()).toBeGreaterThanOrEqual(row.createdAt.getTime());
    });
  });

  describe("payment attempts", () => {
    it("record why an attempt failed", async () => {
      const attempt = await prisma.paymentAttempt.create({
        data: {
          sellerId,
          orderId,
          provider: "ZARINPAL",
          amount: 100_000,
          authority: `A-${mobile}-1`,
          status: "FAILED",
          failureReason: "AMOUNT_MISMATCH",
          failureDetail: "verified 90000",
        },
      });
      expect(attempt).toMatchObject({ failureReason: "AMOUNT_MISMATCH", failureDetail: "verified 90000" });
    });

    it("an authority is unique per gateway, not across gateways", async () => {
      const authority = `A-${mobile}-2`;
      const data = { sellerId, orderId, amount: 100_000, authority };
      await prisma.paymentAttempt.create({ data: { ...data, provider: "ZARINPAL" } });
      await expect(prisma.paymentAttempt.create({ data: { ...data, provider: "IDPAY" } })).resolves.toBeTruthy();
      await expect(prisma.paymentAttempt.create({ data: { ...data, provider: "ZARINPAL" } })).rejects.toMatchObject({
        code: "P2002",
      });
    });

    it("a seller with payment records can't be deleted by accident", async () => {
      // A seller whose only row is a payment attempt.
      const other = await prisma.seller.create({ data: { mobile: `0993${mobile.slice(4)}`, name: "آزمایش حذف" } });
      try {
        await prisma.paymentAttempt.create({ data: { sellerId: other.id, provider: "ZARINPAL", amount: 1_000 } });
        await expect(prisma.seller.delete({ where: { id: other.id } })).rejects.toThrow(/Foreign key/i);
      } finally {
        await prisma.paymentAttempt.deleteMany({ where: { sellerId: other.id } });
        await prisma.seller.delete({ where: { id: other.id } });
      }
    });
  });
});
