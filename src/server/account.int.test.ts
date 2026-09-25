import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hasTestDatabase } from "@/test/setup";
import { DEFAULT_STORE_NAME, ensureSellerAccount } from "./account";

// Runs against a real Postgres (TEST_DATABASE_URL). See docs/phase1/README.md.
describe.skipIf(!hasTestDatabase)("ensureSellerAccount (database)", () => {
  const runId = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  const mobiles: string[] = [];
  const mobile = () => {
    const m = `0996${runId.slice(-6)}${mobiles.length}`;
    mobiles.push(m);
    return m;
  };

  afterAll(async () => {
    await prisma.seller.deleteMany({ where: { mobile: { in: mobiles } } }); // cascades membership + subscription
    await prisma.user.deleteMany({ where: { mobile: { in: mobiles } } });
    await prisma.trialGrant.deleteMany({ where: { mobile: { in: mobiles } } });
    await prisma.$disconnect();
  });

  it("creates seller, user, owner membership and a 14-day trial on first login", async () => {
    const m = mobile();
    const { sellerId } = await ensureSellerAccount(m);

    const seller = await prisma.seller.findUniqueOrThrow({
      where: { id: sellerId },
      include: { memberships: { include: { user: true } }, subscription: true },
    });
    expect(seller.name).toBe(DEFAULT_STORE_NAME);
    expect(seller.memberships).toHaveLength(1);
    expect(seller.memberships[0].role).toBe("OWNER");
    expect(seller.memberships[0].user.mobile).toBe(m);
    expect(seller.subscription?.plan).toBe("TRIAL");
    expect(seller.subscription?.status).toBe("TRIALING");
    const daysLeft = (seller.subscription!.currentPeriodEnd.getTime() - Date.now()) / 86_400_000;
    expect(daysLeft).toBeGreaterThan(13.9);
    expect(daysLeft).toBeLessThanOrEqual(14);
    expect(await prisma.trialGrant.count({ where: { mobile: m } })).toBe(1);
  });

  it("gives a mobile its trial only once: a store deleted and signed up again starts on FREE", async () => {
    const m = mobile();
    const first = await ensureSellerAccount(m);
    await prisma.membership.deleteMany({ where: { sellerId: first.sellerId } });
    await prisma.seller.delete({ where: { id: first.sellerId } }); // cascades the subscription

    const again = await ensureSellerAccount(m);
    expect(again.sellerId).not.toBe(first.sellerId);
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { sellerId: again.sellerId } });
    expect(sub.plan).toBe("FREE");
  });

  it("returns the same account on later logins and changes nothing", async () => {
    const m = mobile();
    const first = await ensureSellerAccount(m);
    await prisma.seller.update({ where: { id: first.sellerId }, data: { name: "بوتیک رز" } });
    const again = await ensureSellerAccount(m);
    expect(again.sellerId).toBe(first.sellerId);
    expect((await prisma.seller.findUniqueOrThrow({ where: { id: first.sellerId } })).name).toBe("بوتیک رز");
    expect(await prisma.membership.count({ where: { sellerId: first.sellerId } })).toBe(1);
    expect(await prisma.subscription.count({ where: { sellerId: first.sellerId } })).toBe(1);
  });

  it("is safe when two first logins for the same mobile arrive at once", async () => {
    const m = mobile();
    const results = await Promise.allSettled([ensureSellerAccount(m), ensureSellerAccount(m), ensureSellerAccount(m)]);
    expect(results.filter((r) => r.status === "rejected")).toEqual([]);
    const ids = new Set(results.map((r) => (r as PromiseFulfilledResult<{ sellerId: string }>).value.sellerId));
    expect(ids.size).toBe(1);
    expect(await prisma.seller.count({ where: { mobile: m } })).toBe(1);
    expect(await prisma.user.count({ where: { mobile: m } })).toBe(1);
  });
});
