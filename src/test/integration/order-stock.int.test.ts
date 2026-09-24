import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hasTestDatabase } from "@/test/setup";
import { OrderError, createOrderInTx } from "@/server/orders/create-order";

// Cross-track integration (A5): Track B's order code on Track A's real stock.
// Complements src/server/orders/orders.int.test.ts (Track B's own tests: take,
// cancel once, return reason, stub-era orders, race for the last item, expiry)
// with the cases that are about the two tracks together.
// Runs against a real Postgres (TEST_DATABASE_URL). See docs/phase1/README.md.

describe.skipIf(!hasTestDatabase)("orders on real stock, cross-track (database)", () => {
  const runId = String(Date.now()).slice(-7);
  let sellerId = "";
  let productId = "";
  let a = "";
  let b = "";
  let c = "";
  let phoneSeq = 0;

  const stockOf = async (id: string) =>
    (await prisma.productVariant.findUniqueOrThrow({ where: { id } })).stock;

  function order(items: { variantId: string; quantity: number }[]) {
    phoneSeq += 1;
    // Built now, not inside the (later-running) transaction callback, so
    // concurrent orders get different customers.
    const phone = `0997${runId.slice(-3)}${String(phoneSeq).padStart(4, "0")}`;
    return prisma.$transaction((tx) =>
      createOrderInTx(tx, {
        sellerId,
        customer: { kind: "new", name: "test", phone },
        shippingAddress: "تهران، خیابان تست، پلاک ۱",
        items,
        source: "MANUAL",
      }),
    );
  }

  /** Track A's invariant: every variant's movements sum to its stock. */
  async function expectLogInSync() {
    const variants = await prisma.productVariant.findMany({
      where: { productId },
      select: { stock: true, stockMovements: { select: { delta: true } } },
    });
    for (const v of variants) {
      expect(v.stockMovements.reduce((s, m) => s + m.delta, 0)).toBe(v.stock);
    }
  }

  async function setStock(id: string, stock: number) {
    await prisma.stockMovement.deleteMany({ where: { variantId: id } });
    await prisma.productVariant.update({ where: { id }, data: { stock } });
    if (stock > 0) await prisma.stockMovement.create({ data: { variantId: id, delta: stock, reason: "INITIAL" } });
  }

  beforeAll(async () => {
    sellerId = (await prisma.seller.create({ data: { name: "t", mobile: `0994${runId}` } })).id;
    productId = (await prisma.product.create({ data: { sellerId, name: "p", price: 100_000 } })).id;
    const mk = (color: string) =>
      prisma.productVariant.create({ data: { sellerId, productId, color, stock: 0 } }).then((v) => v.id);
    [a, b, c] = [await mk("a"), await mk("b"), await mk("c")];
  });

  beforeEach(async () => {
    await prisma.order.deleteMany({ where: { sellerId } });
    await setStock(a, 1);
    await setStock(b, 5);
    await setStock(c, 5);
  });

  afterAll(async () => {
    if (!sellerId) return;
    await prisma.order.deleteMany({ where: { sellerId } });
    await prisma.customer.deleteMany({ where: { sellerId } });
    await prisma.product.deleteMany({ where: { sellerId } });
    await prisma.seller.deleteMany({ where: { id: sellerId } });
    await prisma.$disconnect();
  });

  it("an order that can't be filled changes none of its lines", async () => {
    await expect(
      order([{ variantId: b, quantity: 2 }, { variantId: a, quantity: 3 }]),
    ).rejects.toBeInstanceOf(OrderError);
    expect(await stockOf(b)).toBe(5);
    expect(await prisma.order.count({ where: { sellerId } })).toBe(0);
    await expectLogInSync();
  });

  it("orders sharing variants in opposite line order don't deadlock", async () => {
    // Without a fixed lock order these hang until the test times out.
    await setStock(b, 100);
    await setStock(c, 100);
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) =>
        order(
          i % 2 === 0
            ? [{ variantId: b, quantity: 1 }, { variantId: c, quantity: 1 }]
            : [{ variantId: c, quantity: 1 }, { variantId: b, quantity: 1 }],
        ),
      ),
    );
    expect(results.filter((r) => r.status === "rejected")).toEqual([]);
    expect(await stockOf(b)).toBe(90);
    expect(await stockOf(c)).toBe(90);
    await expectLogInSync();
  });

  // Known issue in Track B's createOrderInTx: a NEW customer's "find by
  // phone, else create" is not safe against two simultaneous orders with the
  // same phone (e.g. a double-click on the buy page). The second fails on the
  // unique (sellerId, phone) constraint instead of reusing the customer.
  // Remove `.fails` once that is fixed.
  it.fails("two simultaneous orders from the same new phone both succeed", async () => {
    const phone = `0998${runId.slice(-3)}0001`;
    const place = () =>
      prisma.$transaction((tx) =>
        createOrderInTx(tx, {
          sellerId,
          customer: { kind: "new", name: "double click", phone },
          shippingAddress: "تهران، خیابان تست، پلاک ۲",
          items: [{ variantId: b, quantity: 1 }],
          source: "MANUAL",
        }),
      );
    const results = await Promise.allSettled([place(), place()]);
    expect(results.filter((r) => r.status === "rejected")).toEqual([]);
  });
});
