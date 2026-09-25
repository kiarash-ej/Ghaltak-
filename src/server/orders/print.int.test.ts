import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { OrderStatus } from "@/generated/prisma/enums";
import { hasTestDatabase } from "@/test/setup";
import { prisma } from "@/lib/prisma";
import { getPrintableOrders } from "./print";
import { orderCode } from "./queries";

// Shipping sheets (B9): only this seller's orders, oldest first, with what
// goes on the parcel.
//
//  order  status           placed        address
//  o1     PAID             09-20 10:00   on the order
//  o2     PREPARING        09-21 10:00   none on the order: the customer's saved one
//  o3     PENDING_PAYMENT  09-22 10:00   not ready to ship
//  o4     SHIPPED          09-19 10:00   has a tracking code
//  ox     PAID             09-18 10:00   another seller's

describe.skipIf(!hasTestDatabase)("printable orders (database)", () => {
  const runId = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  let sellerId = "";
  let otherSellerId = "";
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    sellerId = (await prisma.seller.create({ data: { name: "print test", mobile: `0991${runId}` } })).id;
    otherSellerId = (await prisma.seller.create({ data: { name: "other", mobile: `0992${runId}` } })).id;

    const product = await prisma.product.create({
      data: {
        sellerId,
        name: "مانتو",
        price: 1000,
        variants: { create: [{ sellerId, color: "مشکی", size: "L", stock: 9 }, { sellerId, stock: 9 }] },
      },
      include: { variants: { orderBy: { id: "asc" } } },
    });
    const [withDetail, plain] = product.variants;
    const customer = await prisma.customer.create({
      data: { sellerId, name: "سارا", phone: `0912${runId}`, address: "آدرس ذخیره‌شده" },
    });
    const otherCustomer = await prisma.customer.create({ data: { sellerId: otherSellerId, phone: `0913${runId}` } });

    const order = (owner: string, customerId: string, status: OrderStatus, day: string, extra = {}) =>
      prisma.order.create({
        data: { sellerId: owner, customerId, status, totalPrice: 1000, createdAt: new Date(`2026-09-${day}T10:00:00Z`), ...extra },
      });
    ids.o1 = (
      await order(sellerId, customer.id, "PAID", "20", {
        shippingAddress: "شیراز، خیابان زند",
        shippingMethod: "POST",
        items: {
          create: [
            { productId: product.id, productVariantId: withDetail.id, quantity: 2, unitPrice: 1000 },
            { productId: product.id, productVariantId: plain.id, quantity: 1, unitPrice: 1000 },
          ],
        },
      })
    ).id;
    ids.o2 = (await order(sellerId, customer.id, "PREPARING", "21")).id;
    ids.o3 = (await order(sellerId, customer.id, "PENDING_PAYMENT", "22")).id;
    ids.o4 = (
      await order(sellerId, customer.id, "SHIPPED", "19", { shippingMethod: "COURIER", trackingCode: "TRK-123" })
    ).id;
    ids.ox = (await order(otherSellerId, otherCustomer.id, "PAID", "18")).id;
  });

  afterAll(async () => {
    const sellers = { sellerId: { in: [sellerId, otherSellerId] } };
    await prisma.order.deleteMany({ where: sellers });
    await prisma.productVariant.deleteMany({ where: sellers });
    await prisma.product.deleteMany({ where: sellers });
    await prisma.customer.deleteMany({ where: sellers });
    await prisma.seller.deleteMany({ where: { id: { in: [sellerId, otherSellerId] } } });
  });

  it("prints only this seller's chosen orders, oldest first", async () => {
    const orders = await getPrintableOrders(sellerId, { kind: "ids", ids: [ids.o1, ids.ox, ids.o4] });
    expect(orders.map((o) => o.id)).toEqual([ids.o4, ids.o1]);
  });

  it("never prints another seller's order, even asked by id", async () => {
    expect(await getPrintableOrders(sellerId, { kind: "ids", ids: [ids.ox] })).toEqual([]);
  });

  it("«ready» is every paid or preparing order", async () => {
    const orders = await getPrintableOrders(sellerId, { kind: "ready" });
    expect(orders.map((o) => o.id)).toEqual([ids.o1, ids.o2]);
  });

  it("has what goes on the parcel", async () => {
    const [o1] = await getPrintableOrders(sellerId, { kind: "ids", ids: [ids.o1] });
    expect(o1).toMatchObject({
      code: orderCode(ids.o1),
      customerName: "سارا",
      customerPhone: `0912${runId}`,
      address: "شیراز، خیابان زند",
      shippingMethod: "پست",
      trackingCode: null,
      items: [
        { name: "مانتو", detail: "مشکی / L", quantity: 2 },
        { name: "مانتو", detail: "", quantity: 1 },
      ],
    });

    const [o2] = await getPrintableOrders(sellerId, { kind: "ids", ids: [ids.o2] });
    expect(o2.address).toBe("آدرس ذخیره‌شده");
    const [o4] = await getPrintableOrders(sellerId, { kind: "ids", ids: [ids.o4] });
    expect([o4.shippingMethod, o4.trackingCode]).toEqual(["پیک", "TRK-123"]);
  });

  it("asks the database for nothing when nothing was chosen", async () => {
    expect(await getPrintableOrders(sellerId, { kind: "ids", ids: [] })).toEqual([]);
  });
});
