import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hasTestDatabase } from "@/test/setup";

// The manual "delete my store" procedure (DEPLOY.md, section 10) runs these
// two files in psql on production. This runs the same files against a store
// that has a row in every table that points at a seller, so a new table that
// the files don't know about fails here, in CI, instead of on the day a seller
// asks to be deleted.

const sql = (name: string, sellerId: string) =>
  readFileSync(path.resolve("deploy/privacy", name), "utf8").replaceAll(":'seller_id'", `'${sellerId}'`);

describe.skipIf(!hasTestDatabase)("deleting a store on request (database)", () => {
  const runId = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  const mobile = `0970${runId}`;
  const otherMobile = `0971${runId}`;
  const memberMobile = `0972${runId}`;
  let sellerId = "";
  let otherId = "";

  beforeAll(async () => {
    // The store to delete: one of everything.
    const seller = await prisma.seller.create({
      data: {
        mobile,
        name: "حذفی",
        logoUrl: "/uploads/logos/00000000-0000-4000-8000-000000000001.webp",
        subscription: { create: { currentPeriodEnd: new Date() } },
        gateway: { create: { provider: "ZARINPAL", credentialsEncrypted: "v1.x" } },
      },
    });
    sellerId = seller.id;
    const product = await prisma.product.create({
      data: {
        sellerId,
        name: "p",
        price: 1000,
        imageUrl: "/uploads/products/00000000-0000-4000-8000-000000000002.webp",
        variants: { create: { sellerId, stock: 3 } },
      },
      include: { variants: true },
    });
    const variant = product.variants[0];
    await prisma.stockMovement.create({ data: { variantId: variant.id, delta: 3, reason: "INITIAL" } });
    const link = await prisma.purchaseLink.create({
      data: { sellerId, token: `del-${runId}-xxxxxxxxxxxxx`, products: { connect: { id: product.id } } },
    });
    await prisma.linkDailyView.create({ data: { purchaseLinkId: link.id, day: new Date("2026-09-26"), views: 4 } });
    const customer = await prisma.customer.create({ data: { sellerId, phone: `0935${runId}`, name: "مشتری" } });
    const order = await prisma.order.create({
      data: {
        sellerId,
        customerId: customer.id,
        purchaseLinkId: link.id,
        source: "PURCHASE_LINK",
        totalPrice: 1000,
        receiptImageUrl: "receipts/00000000-0000-4000-8000-000000000003.png",
        items: { create: { productId: product.id, productVariantId: variant.id, quantity: 1, unitPrice: 1000 } },
      },
    });
    const invoice = await prisma.invoice.create({
      data: { sellerId, plan: "BASIC", amount: 1, periodStart: new Date(), periodEnd: new Date() },
    });
    await prisma.paymentAttempt.createMany({
      data: [
        { sellerId, orderId: order.id, provider: "ZARINPAL", amount: 1000 },
        { sellerId, invoiceId: invoice.id, provider: "ZARINPAL", amount: 1 },
      ],
    });
    await prisma.smsMessage.createMany({
      data: [
        { sellerId, to: customer.phone, kind: "ORDER_PLACED", orderId: order.id, status: "DEV" },
        { to: mobile, kind: "LOGIN_OTP", status: "DEV" }, // the seller's own login codes
      ],
    });
    await prisma.otpCode.create({ data: { mobile, codeHash: "x", expiresAt: new Date() } });

    // Another store, which shares a team member with the one being deleted.
    const other = await prisma.seller.create({ data: { mobile: otherMobile, name: "بماند" } });
    otherId = other.id;
    await prisma.customer.create({ data: { sellerId: otherId, phone: `0935${runId}` } });
    await prisma.smsMessage.create({ data: { to: otherMobile, kind: "LOGIN_OTP", status: "DEV" } });

    const owner = await prisma.user.create({ data: { mobile } });
    const member = await prisma.user.create({ data: { mobile: memberMobile } });
    await prisma.membership.createMany({
      data: [
        { userId: owner.id, sellerId, role: "OWNER" },
        { userId: member.id, sellerId, role: "OPERATOR" },
        { userId: member.id, sellerId: otherId, role: "OPERATOR" },
      ],
    });
    // Signed-in devices (A10): the owner's and the shared member's in this
    // store, and the member's in the other store, which must stay.
    await prisma.session.createMany({
      data: [
        { userId: owner.id, sellerId },
        { userId: member.id, sellerId },
        { userId: member.id, sellerId: otherId },
      ],
    });
  });

  afterAll(async () => {
    await prisma.smsMessage.deleteMany({ where: { to: { in: [mobile, otherMobile] } } });
    await prisma.session.deleteMany({ where: { sellerId: { in: [sellerId, otherId].filter(Boolean) } } });
    await prisma.membership.deleteMany({ where: { sellerId: { in: [sellerId, otherId].filter(Boolean) } } });
    await prisma.user.deleteMany({ where: { mobile: { in: [mobile, otherMobile, memberMobile] } } });
    await prisma.customer.deleteMany({ where: { sellerId: otherId } });
    await prisma.seller.deleteMany({ where: { id: otherId } });
    await prisma.$disconnect();
  });

  it("lists the store's files as storage keys, then deletes every row of it and nothing else", async () => {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      const files = (await client.query(sql("store-files.sql", sellerId))).rows;
      expect(files).toEqual(
        expect.arrayContaining([
          { bucket: "public", key: "products/00000000-0000-4000-8000-000000000002.webp" },
          { bucket: "public", key: "logos/00000000-0000-4000-8000-000000000001.webp" },
          { bucket: "private", key: "receipts/00000000-0000-4000-8000-000000000003.png" },
        ]),
      );
      expect(files).toHaveLength(3);

      // The file leaves the transaction open for a person to check; then COMMIT.
      const results = (await client.query(sql("delete-store.sql", sellerId))) as unknown as pg.QueryResult[];
      expect(results.at(-1)!.rows[0]).toEqual({ stores_deleted: "1", rows_left: "0" });
      await client.query("COMMIT");
    } finally {
      await client.end();
    }

    const bySeller = { where: { sellerId } };
    expect(await prisma.seller.count({ where: { id: sellerId } })).toBe(0);
    for (const count of await Promise.all([
      prisma.product.count(bySeller),
      prisma.productVariant.count(bySeller),
      prisma.customer.count(bySeller),
      prisma.order.count(bySeller),
      prisma.purchaseLink.count(bySeller),
      prisma.invoice.count(bySeller),
      prisma.paymentAttempt.count(bySeller),
      prisma.smsMessage.count(bySeller),
      prisma.membership.count(bySeller),
      prisma.subscription.count(bySeller),
      prisma.sellerGateway.count(bySeller),
      prisma.session.count(bySeller),
      prisma.smsMessage.count({ where: { to: mobile } }),
      prisma.otpCode.count({ where: { mobile } }),
      prisma.user.count({ where: { mobile } }),
    ])) {
      expect(count).toBe(0);
    }

    // The other store is untouched, and so is the team member who still belongs to it.
    expect(await prisma.seller.count({ where: { id: otherId } })).toBe(1);
    expect(await prisma.customer.count({ where: { sellerId: otherId } })).toBe(1);
    expect(await prisma.smsMessage.count({ where: { to: otherMobile } })).toBe(1);
    expect(await prisma.membership.count({ where: { sellerId: otherId } })).toBe(1);
    expect(await prisma.session.count({ where: { sellerId: otherId } })).toBe(1);
    expect(await prisma.user.count({ where: { mobile: memberMobile } })).toBe(1);
  });
});
