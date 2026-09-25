import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hasTestDatabase } from "@/test/setup";
import { DEFAULT_STORE_NAME, ensureSellerAccount } from "./account";

// Runs against a real Postgres (TEST_DATABASE_URL). See docs/phase1/README.md.
describe.skipIf(!hasTestDatabase)("ensureSellerAccount (database)", () => {
  const runId = String(Date.now()).slice(-7);
  const mobiles: string[] = [];
  const mobile = () => {
    const m = `0996${runId}${mobiles.length}`.slice(0, 11);
    mobiles.push(m);
    return m;
  };

  afterAll(async () => {
    await prisma.seller.deleteMany({ where: { mobile: { in: mobiles } } }); // cascades membership + subscription
    await prisma.user.deleteMany({ where: { mobile: { in: mobiles } } });
    await prisma.$disconnect();
  });

  it("creates seller, user, owner membership and a 30-day trial on first login", async () => {
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
    expect(daysLeft).toBeGreaterThan(29.9);
    expect(daysLeft).toBeLessThanOrEqual(30);
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
