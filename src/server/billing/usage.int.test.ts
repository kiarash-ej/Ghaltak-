import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hasTestDatabase } from "@/test/setup";
import { canUse, getPlanUsage, hasProductSlotInTx } from "./usage";

// Plan limits against a real Postgres (docs/phase2/specs/A9-billing.md, section 3).

const DAY = 24 * 60 * 60 * 1000;

describe.skipIf(!hasTestDatabase)("plan limits (database)", () => {
  const runId = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  const sellerIds: string[] = [];
  let n = 0;
  const previous = process.env.BILLING_ENABLED;

  beforeEach(() => {
    process.env.BILLING_ENABLED = "true";
  });
  afterEach(() => {
    process.env.BILLING_ENABLED = previous;
  });
  afterAll(async () => {
    await prisma.smsMessage.deleteMany({ where: { sellerId: { in: sellerIds } } });
    await prisma.product.deleteMany({ where: { sellerId: { in: sellerIds } } });
    await prisma.membership.deleteMany({ where: { sellerId: { in: sellerIds } } });
    await prisma.user.deleteMany({ where: { mobile: { startsWith: `0995${runId.slice(-5)}` } } });
    await prisma.seller.deleteMany({ where: { id: { in: sellerIds } } });
    await prisma.$disconnect();
  });

  async function store(plan: "TRIAL" | "FREE" | "BASIC" | "PRO", periodEnd: Date) {
    const seller = await prisma.seller.create({
      data: {
        name: "فروشگاه آزمایشی",
        mobile: `0995${runId.slice(-5)}${String(n++).padStart(2, "0")}`,
        subscription: { create: { plan, status: plan === "TRIAL" ? "TRIALING" : "ACTIVE", currentPeriodEnd: periodEnd } },
      },
    });
    sellerIds.push(seller.id);
    return seller.id;
  }
  const products = (sellerId: string, count: number, isActive = true) =>
    prisma.product.createMany({
      data: Array.from({ length: count }, (_, i) => ({ sellerId, name: `کالا ${i}`, price: 1000, isActive })),
    });
  const future = () => new Date(Date.now() + 5 * DAY);

  it("trial has the BASIC limit of 10 active products; inactive ones don't count", async () => {
    const id = await store("TRIAL", future());
    await products(id, 9);
    await products(id, 5, false);
    expect(await canUse(id, "addProduct")).toBe(true);
    await products(id, 1);
    expect(await canUse(id, "addProduct")).toBe(false);
  });

  it("an ended trial falls to FREE at once: 5 products, 60 SMS, 1 member", async () => {
    const id = await store("TRIAL", new Date(Date.now() - 1000));
    await products(id, 5);
    expect(await canUse(id, "addProduct")).toBe(false);

    const usage = await getPlanUsage(id);
    expect(usage.effective.state).toBe("FREE");
    expect(usage.products).toEqual({ used: 5, limit: 5 });
    expect(usage.sms.limit).toBe(60);
    expect(usage.members.limit).toBe(1);
  });

  it("a paid plan keeps its limits for 7 days past its end, then FREE", async () => {
    const inGrace = await store("PRO", new Date(Date.now() - 6 * DAY));
    await products(inGrace, 20);
    expect(await canUse(inGrace, "addProduct")).toBe(true);
    expect((await getPlanUsage(inGrace)).effective.state).toBe("PAST_DUE");

    const over = await store("PRO", new Date(Date.now() - 8 * DAY));
    await products(over, 20);
    expect(await canUse(over, "addProduct")).toBe(false);
  });

  it("SMS quota counts only order SMS this month", async () => {
    const id = await store("FREE", new Date());
    const sms = (kind: "ORDER_PLACED" | "LOGIN_OTP", count: number) =>
      prisma.smsMessage.createMany({
        data: Array.from({ length: count }, () => ({ sellerId: id, to: "09350000000", kind, status: "SENT" as const })),
      });
    await sms("LOGIN_OTP", 100);
    await sms("ORDER_PLACED", 59);
    expect(await canUse(id, "extraSms")).toBe(true);
    await sms("ORDER_PLACED", 1);
    expect(await canUse(id, "extraSms")).toBe(false);
  });

  it("members: FREE allows only the owner", async () => {
    const id = await store("FREE", new Date());
    expect(await canUse(id, "addMember")).toBe(true);
    const user = await prisma.user.create({ data: { mobile: `0995${runId.slice(-5)}99` } });
    await prisma.membership.create({ data: { sellerId: id, userId: user.id, role: "OWNER" } });
    expect(await canUse(id, "addMember")).toBe(false);
  });

  it("with billing off nothing is limited, but usage is still counted", async () => {
    process.env.BILLING_ENABLED = "false";
    const id = await store("TRIAL", new Date(Date.now() - 100 * DAY));
    await products(id, 30);
    expect(await canUse(id, "addProduct")).toBe(true);
    const usage = await getPlanUsage(id);
    expect(usage.effective).toMatchObject({ state: "TRIAL", enforced: false });
    expect(usage.products.used).toBe(30);
  });

  it("two saves at the same moment can't both take the last product slot", async () => {
    const id = await store("FREE", new Date());
    await products(id, 4);
    const save = () =>
      prisma.$transaction(async (tx) => {
        if (!(await hasProductSlotInTx(tx, id))) return false;
        await new Promise((r) => setTimeout(r, 50)); // widen the race
        await tx.product.create({ data: { sellerId: id, name: "آخری", price: 1000 } });
        return true;
      });
    const results = await Promise.all([save(), save(), save()]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await prisma.product.count({ where: { sellerId: id, isActive: true } })).toBe(5);
  });

  it("activating a product doesn't count itself as already active", async () => {
    const id = await store("FREE", new Date());
    await products(id, 4);
    const off = await prisma.product.create({ data: { sellerId: id, name: "خاموش", price: 1000, isActive: false } });
    const ok = await prisma.$transaction((tx) => hasProductSlotInTx(tx, id, { excludeProductId: off.id }));
    expect(ok).toBe(true);
  });
});
