import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { OrderStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { hasTestDatabase } from "@/test/setup";
import { csvLine, type CsvValue } from "./csv";
import { CUSTOMER_HEADER, customerRows } from "./customers";
import { jalaliDayStart } from "./jalali";
import { ORDER_HEADER, orderRows } from "./orders";
import { PRODUCT_HEADER, productRows } from "./products";

// The three CSV exports (C6) against a real Postgres (TEST_DATABASE_URL).
//
// Seller A has products, customers and orders, plus card, Sheba, gateway and
// online-payment details that must never reach a file. Seller B has one of
// everything, which must never appear in A's files. Batches of 1 or 2 rows
// make every export go through several batches, as a big store would.

const SECRETS = [
  "v1.SECRET-CARD",
  "v1.SECRET-SHEBA",
  "v1.SECRET-GATEWAY",
  "603799******7893",
  "AUTH-SECRET-1",
  "REF-SECRET-1",
];
const HOSTILE_NAME = '=HYPERLINK("http://evil.example","x")';

async function csvOf(batches: AsyncIterable<CsvValue[][]>, header: string[]) {
  let text = csvLine(header);
  let rows = 0;
  for await (const batch of batches) {
    for (const row of batch) {
      text += csvLine(row);
      rows++;
    }
  }
  return { text, rows };
}

describe.skipIf(!hasTestDatabase)("data export (database)", () => {
  const runId = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  const mobileA = `0980${runId}`;
  const mobileB = `0981${runId}`;
  let sellerA = "";
  let sellerB = "";

  async function order(sellerId: string, customerId: string, status: OrderStatus, createdAt: string, total: number) {
    // Always the same variant: A's black M coat (the first SKU), B's only one.
    // Without an order Postgres may return any row, and under load it did.
    const variant = await prisma.productVariant.findFirstOrThrow({
      where: { sellerId },
      orderBy: { sku: { sort: "asc", nulls: "last" } },
    });
    return prisma.order.create({
      data: {
        sellerId,
        customerId,
        status,
        totalPrice: total,
        createdAt: new Date(createdAt),
        shippingAddress: "شیراز، خیابان زند",
        items: { create: { productId: variant.productId, productVariantId: variant.id, quantity: 1, unitPrice: total } },
      },
    });
  }

  beforeAll(async () => {
    sellerA = (
      await prisma.seller.create({
        data: {
          mobile: mobileA,
          name: "فروشگاه الف",
          cardNumberEncrypted: "v1.SECRET-CARD",
          cardHolder: "صاحب کارت",
          shebaEncrypted: "v1.SECRET-SHEBA",
          gateway: { create: { provider: "ZARINPAL", credentialsEncrypted: "v1.SECRET-GATEWAY", isActive: true } },
        },
      })
    ).id;
    sellerB = (await prisma.seller.create({ data: { mobile: mobileB, name: "فروشگاه ب" } })).id;

    // A: an active coat with two variants (out of stock, plenty), a hidden
    // scarf (low), and a product whose name is a formula.
    await prisma.product.create({
      data: {
        sellerId: sellerA,
        name: "مانتو کتان",
        category: "مانتو",
        price: 1_280_000,
        variants: {
          create: [
            { sellerId: sellerA, color: "مشکی", size: "M", sku: `A-${runId}-1`, stock: 0 },
            { sellerId: sellerA, color: "کرم", size: "L", sku: `A-${runId}-2`, stock: 10 },
          ],
        },
      },
    });
    await prisma.product.create({
      data: { sellerId: sellerA, name: "شال", price: 300_000, isActive: false, variants: { create: { sellerId: sellerA, stock: 1 } } },
    });
    await prisma.product.create({
      data: { sellerId: sellerA, name: "=1+1", price: 1, variants: { create: { sellerId: sellerA, stock: 5 } } },
    });
    await prisma.product.create({
      data: { sellerId: sellerB, name: "B-ONLY-PRODUCT", price: 1, variants: { create: { sellerId: sellerB, stock: 5 } } },
    });

    const hostile = await prisma.customer.create({
      data: { sellerId: sellerA, name: HOSTILE_NAME, phone: `0912${runId}`, address: "-آدرس" },
    });
    await prisma.customer.create({ data: { sellerId: sellerA, name: "بی‌سفارش", phone: `0913${runId}` } });
    const customerB = await prisma.customer.create({
      data: { sellerId: sellerB, name: "B-ONLY-CUSTOMER", phone: `0914${runId}` },
    });

    // A's orders. 1 Mehr 1405 starts at 2026-09-22T20:30Z (Tehran midnight).
    await order(sellerA, hostile.id, "DELIVERED", "2026-09-22T20:45:00Z", 2000); // 1 Mehr, 00:15
    await order(sellerA, hostile.id, "PAID", "2026-09-23T10:00:00Z", 1000); // 1 Mehr
    await order(sellerA, hostile.id, "CANCELED", "2026-09-24T10:00:00Z", 500); // 2 Mehr
    await order(sellerA, hostile.id, "RETURNED", "2026-09-22T20:00:00Z", 700); // 31 Shahrivar, 23:30
    const online = await order(sellerA, hostile.id, "PENDING_PAYMENT", "2026-09-25T10:00:00Z", 300); // 3 Mehr
    await prisma.paymentAttempt.create({
      data: {
        sellerId: sellerA,
        orderId: online.id,
        provider: "ZARINPAL",
        amount: 300,
        authority: "AUTH-SECRET-1",
        refId: "REF-SECRET-1",
        cardPanMasked: "603799******7893",
        status: "VERIFIED",
      },
    });
    await order(sellerB, customerB.id, "PAID", "2026-09-23T10:00:00Z", 999);

  });

  afterAll(async () => {
    const ids = [sellerA, sellerB].filter(Boolean);
    await prisma.paymentAttempt.deleteMany({ where: { sellerId: { in: ids } } });
    await prisma.order.deleteMany({ where: { sellerId: { in: ids } } });
    await prisma.customer.deleteMany({ where: { sellerId: { in: ids } } });
    await prisma.productVariant.deleteMany({ where: { sellerId: { in: ids } } });
    await prisma.product.deleteMany({ where: { sellerId: { in: ids } } });
    await prisma.seller.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  function expectClean(text: string) {
    for (const secret of SECRETS) expect(text).not.toContain(secret);
    expect(text).not.toContain("B-ONLY");
    expect(text).not.toContain("صاحب کارت");
    // The hostile name is there, but only as text.
    expect(text).not.toMatch(/(^|,|")=HYPERLINK/m);
  }

  it("products: one row per variant, the inventory page's stock and status, this seller only", async () => {
    const { text, rows } = await csvOf(productRows(sellerA, { batchSize: 1 }), PRODUCT_HEADER);
    expect(rows).toBe(4);
    expectClean(text);
    expect(text).toContain(`مانتو کتان,مانتو,1280000,بله,مشکی,M,A-${runId}-1,0,3,ناموجود\r\n`);
    expect(text).toContain(`مانتو کتان,مانتو,1280000,بله,کرم,L,A-${runId}-2,10,3,کافی\r\n`);
    expect(text).toContain("شال,,300000,خیر,,,,1,3,کم‌موجودی\r\n");
    expect(text).toContain("'=1+1,");
  });

  it("customers: the profile's stats (purchases are paid, not canceled or returned), this seller only", async () => {
    const { text, rows } = await csvOf(customerRows(sellerA, { batchSize: 1 }), CUSTOMER_HEADER);
    expect(rows).toBe(2);
    expectClean(text);
    // 5 orders; purchases: DELIVERED 2000 + PAID 1000; one return.
    const phone = `0912 ${runId.slice(0, 3)} ${runId.slice(3)}`;
    expect(text).toContain(`"'=HYPERLINK(""http://evil.example"",""x"")",${phone},'-آدرس,جدید,`);
    expect(text).toMatch(/,5,2,3000,1500,1405\/07\/01,1\r\n/);
    expect(text).toMatch(/بی‌سفارش,0913 [^,]+,,جدید,[^,]+,0,0,0,,,0\r\n/);
  });

  it("orders: every order of this seller, with the sale flag from the sales report", async () => {
    const { text, rows } = await csvOf(orderRows(sellerA, {}, { batchSize: 2 }), ORDER_HEADER);
    expect(rows).toBe(5);
    expectClean(text);
    expect(text).toContain("1405/07/01,00:15,تحویل‌شده,بله,دستی,");
    expect(text).toContain("1405/06/31,23:30,مرجوعی,خیر,دستی,");
    expect(text).toContain("مانتو کتان (مشکی / M) × 1");
  });

  it("orders: a Jalali date range covers whole Tehran days, and a status filter", async () => {
    const mehr1 = jalaliDayStart({ year: 1405, month: 7, day: 1 });
    const mehr2End = jalaliDayStart({ year: 1405, month: 7, day: 3 });
    const inRange = await csvOf(orderRows(sellerA, { from: mehr1, to: mehr2End }, { batchSize: 2 }), ORDER_HEADER);
    expect(inRange.rows).toBe(3); // 1 Mehr ×2 (one at 00:15), 2 Mehr; not 31 Shahrivar 23:30 or 3 Mehr
    expect(inRange.text).not.toContain("1405/06/31");
    expect(inRange.text).not.toContain("1405/07/03");

    const paid = await csvOf(orderRows(sellerA, { status: "PAID" }, { batchSize: 2 }), ORDER_HEADER);
    expect(paid.rows).toBe(1);
    expect(paid.text).toContain(",پرداخت‌شده,بله,");
  });
});
