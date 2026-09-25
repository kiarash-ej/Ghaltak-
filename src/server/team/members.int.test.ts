import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { startSession, validateSession } from "@/server/sessions";
import { hasTestDatabase } from "@/test/setup";
import { inviteMember, listMembers, removeMember } from "./members";

// Team members against a real Postgres (docs/phase2/specs/A10-team.md, section 4).

const DAY = 24 * 60 * 60 * 1000;

describe.skipIf(!hasTestDatabase)("team members (database)", () => {
  const runId = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  const mobiles: string[] = [];
  const previous = process.env.BILLING_ENABLED;
  const mobile = () => {
    const m = `0991${runId.slice(-5)}${String(mobiles.length).padStart(2, "0")}`;
    mobiles.push(m);
    return m;
  };

  beforeEach(() => {
    process.env.BILLING_ENABLED = "true";
  });
  afterEach(() => {
    process.env.BILLING_ENABLED = previous;
  });
  afterAll(async () => {
    await prisma.seller.deleteMany({ where: { mobile: { in: mobiles } } });
    await prisma.user.deleteMany({ where: { mobile: { in: mobiles } } });
    await prisma.$disconnect();
  });

  async function store(plan: "TRIAL" | "FREE" | "BASIC" = "BASIC") {
    const m = mobile();
    const owner = await prisma.user.create({ data: { mobile: m } });
    const seller = await prisma.seller.create({
      data: {
        name: "فروشگاه",
        mobile: m,
        subscription: { create: { plan, currentPeriodEnd: new Date(Date.now() + 10 * DAY) } },
        memberships: { create: { userId: owner.id, role: "OWNER" } },
      },
    });
    return { sellerId: seller.id, ownerId: owner.id, ownerMobile: m };
  }

  it("invites an operator at once; a second invite or the owner's own mobile is refused", async () => {
    const s = await store();
    const m = mobile();
    const r = await inviteMember(s.sellerId, m);
    expect(r).toMatchObject({ ok: true });
    expect(await inviteMember(s.sellerId, m)).toEqual({ ok: false, reason: "ALREADY_MEMBER" });
    expect(await inviteMember(s.sellerId, s.ownerMobile)).toEqual({ ok: false, reason: "ALREADY_MEMBER" });

    const members = await listMembers(s.sellerId);
    expect(members.map((x) => x.role)).toEqual(["OWNER", "OPERATOR"]);
    expect(members[1].mobile).toBe(m);
  });

  it("an existing user (with their own store) can be invited to another store", async () => {
    const mine = await store();
    const other = await store();
    expect(await inviteMember(other.sellerId, mine.ownerMobile)).toMatchObject({ ok: true, userId: mine.ownerId });
  });

  it("the plan's member limit: BASIC has 4 with the owner; FREE only the owner", async () => {
    const s = await store("BASIC");
    for (let i = 0; i < 3; i++) expect(await inviteMember(s.sellerId, mobile())).toMatchObject({ ok: true });
    expect(await inviteMember(s.sellerId, mobile())).toEqual({ ok: false, reason: "LIMIT" });

    const free = await store("FREE");
    expect(await inviteMember(free.sellerId, mobile())).toEqual({ ok: false, reason: "LIMIT" });
  });

  it("simultaneous invites can't go over the limit", async () => {
    const s = await store("BASIC");
    const results = await Promise.all(Array.from({ length: 8 }, () => inviteMember(s.sellerId, mobile())));
    expect(results.filter((r) => r.ok)).toHaveLength(3);
    expect(await prisma.membership.count({ where: { sellerId: s.sellerId } })).toBe(4);
  });

  it("removing an operator signs them out everywhere in that store; the owner can't be removed", async () => {
    const s = await store();
    const invited = await inviteMember(s.sellerId, mobile());
    if (!invited.ok) throw new Error("invite failed");
    const started = await startSession({ userId: invited.userId, sellerId: s.sellerId });
    if (!started.ok) throw new Error("sign-in failed");

    expect(await removeMember(s.sellerId, s.ownerId)).toBe(false);
    expect(await removeMember(s.sellerId, invited.userId)).toBe(true);
    expect(await validateSession({ sid: started.sessionId, userId: invited.userId, sellerId: s.sellerId })).toBeNull();
    expect(await prisma.membership.count({ where: { sellerId: s.sellerId } })).toBe(1);
  });

  it("an owner can't remove a member of another store", async () => {
    const a = await store();
    const b = await store();
    const invited = await inviteMember(b.sellerId, mobile());
    if (!invited.ok) throw new Error("invite failed");
    expect(await removeMember(a.sellerId, invited.userId)).toBe(false);
    expect(await prisma.membership.count({ where: { sellerId: b.sellerId } })).toBe(2);
  });
});
