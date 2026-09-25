import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hasTestDatabase } from "@/test/setup";
import { accountForLogin } from "./account";
import { revokeMemberSessions, startSession, validateSession } from "./sessions";

// Sessions, roles and device limits against a real Postgres
// (docs/phase2/specs/A10-team.md, sections 2, 3 and 5).

const DAY = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;

describe.skipIf(!hasTestDatabase)("sessions and devices (database)", () => {
  const runId = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  const mobiles: string[] = [];
  const previous = process.env.BILLING_ENABLED;
  const mobile = () => {
    const m = `0992${runId.slice(-5)}${String(mobiles.length).padStart(2, "0")}`;
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
    await prisma.seller.deleteMany({ where: { mobile: { in: mobiles } } }); // cascades memberships, sessions, subscription
    await prisma.user.deleteMany({ where: { mobile: { in: mobiles } } });
    await prisma.trialGrant.deleteMany({ where: { mobile: { in: mobiles } } });
    await prisma.$disconnect();
  });

  /** A store with its owner, on `plan` until `end`. */
  async function store(plan: "TRIAL" | "FREE" | "BASIC" = "TRIAL", end = new Date(Date.now() + 10 * DAY)) {
    const m = mobile();
    const owner = await prisma.user.create({ data: { mobile: m } });
    const seller = await prisma.seller.create({
      data: {
        name: `فروشگاه ${m.slice(-3)}`,
        mobile: m,
        subscription: { create: { plan, currentPeriodEnd: end } },
        memberships: { create: { userId: owner.id, role: "OWNER" } },
      },
    });
    return { sellerId: seller.id, ownerId: owner.id };
  }
  async function operator(sellerId: string) {
    const user = await prisma.user.create({ data: { mobile: mobile() } });
    await prisma.membership.create({ data: { sellerId, userId: user.id, role: "OPERATOR" } });
    return user.id;
  }
  async function signIn(userId: string, sellerId: string, now: Date) {
    const r = await startSession({ userId, sellerId, now });
    if (!r.ok) throw new Error(r.reason);
    return r.sessionId;
  }
  const valid = (sid: string, userId: string, sellerId: string, now = new Date()) =>
    validateSession({ sid, userId, sellerId }, now);

  it("a session is valid for its own user and store only", async () => {
    const a = await store();
    const b = await store();
    const sid = await signIn(a.ownerId, a.sellerId, new Date());
    expect(await valid(sid, a.ownerId, a.sellerId)).toMatchObject({ role: "OWNER", sellerId: a.sellerId });
    // A cookie edited to point at another store or user is refused.
    expect(await valid(sid, a.ownerId, b.sellerId)).toBeNull();
    expect(await valid(sid, b.ownerId, a.sellerId)).toBeNull();
    // Not a member of b: no session there.
    expect(await startSession({ userId: a.ownerId, sellerId: b.sellerId })).toEqual({ ok: false, reason: "NOT_A_MEMBER" });
  });

  it("a removed member is signed out on the next request", async () => {
    const s = await store();
    const op = await operator(s.sellerId);
    const sid = await signIn(op, s.sellerId, new Date());
    expect(await valid(sid, op, s.sellerId)).toMatchObject({ role: "OPERATOR" });
    await prisma.membership.delete({ where: { userId_sellerId: { userId: op, sellerId: s.sellerId } } });
    expect(await valid(sid, op, s.sellerId)).toBeNull();
    expect((await prisma.session.findUniqueOrThrow({ where: { id: sid } })).revokedAt).not.toBeNull();
  });

  it("«sign out of all devices» ends every session of that person in that store", async () => {
    const s = await store();
    const t = Date.now();
    const one = await signIn(s.ownerId, s.sellerId, new Date(t));
    const two = await signIn(s.ownerId, s.sellerId, new Date(t + MIN));
    expect(await revokeMemberSessions(s.sellerId, s.ownerId, { except: two })).toBe(1);
    expect(await valid(one, s.ownerId, s.sellerId)).toBeNull();
    expect(await valid(two, s.ownerId, s.sellerId)).not.toBeNull();
  });

  it("trial and paid plans: 2 devices per person; a third sign-in ends that person's least recently used", async () => {
    const s = await store("TRIAL");
    const op = await operator(s.sellerId);
    const t = Date.now();
    const opSid = await signIn(op, s.sellerId, new Date(t));
    const first = await signIn(s.ownerId, s.sellerId, new Date(t + MIN));
    const second = await signIn(s.ownerId, s.sellerId, new Date(t + 2 * MIN));
    const third = await signIn(s.ownerId, s.sellerId, new Date(t + 3 * MIN));
    const now = new Date(t + 4 * MIN);
    expect(await valid(first, s.ownerId, s.sellerId, now)).toBeNull();
    expect(await valid(second, s.ownerId, s.sellerId, now)).not.toBeNull();
    expect(await valid(third, s.ownerId, s.sellerId, now)).not.toBeNull();
    expect(await valid(opSid, op, s.sellerId, now)).not.toBeNull(); // someone else's devices are untouched
  });

  it("when the plan has ended (FREE): only the owner's newest device stays, operators are out", async () => {
    const t = Date.now();
    const s = await store("BASIC", new Date(t + 10 * DAY));
    const op = await operator(s.sellerId);
    const opSid = await signIn(op, s.sellerId, new Date(t));
    const older = await signIn(s.ownerId, s.sellerId, new Date(t + MIN));
    const newer = await signIn(s.ownerId, s.sellerId, new Date(t + 2 * MIN));

    // 10 days of plan + 7 days of grace later.
    const later = new Date(t + 18 * DAY);
    expect(await valid(opSid, op, s.sellerId, later)).toBeNull();
    expect(await valid(older, s.ownerId, s.sellerId, later)).toBeNull();
    expect(await valid(newer, s.ownerId, s.sellerId, later)).toMatchObject({ role: "OWNER" });

    // The operator can't sign in again until the plan is renewed; the membership stays.
    expect(await startSession({ userId: op, sellerId: s.sellerId, now: later })).toEqual({ ok: false, reason: "PLAN_ENDED" });
    expect(await prisma.membership.count({ where: { sellerId: s.sellerId } })).toBe(2);

    // The owner signing in on another device makes that the one device.
    const phone = await signIn(s.ownerId, s.sellerId, later);
    expect(await valid(newer, s.ownerId, s.sellerId, later)).toBeNull();
    expect(await valid(phone, s.ownerId, s.sellerId, later)).not.toBeNull();
  });

  it("with billing off there is no device limit", async () => {
    process.env.BILLING_ENABLED = "false";
    const s = await store("FREE");
    const op = await operator(s.sellerId);
    const t = Date.now();
    const sids = [];
    for (let i = 0; i < 4; i++) sids.push(await signIn(s.ownerId, s.sellerId, new Date(t + i * MIN)));
    const opSid = await signIn(op, s.sellerId, new Date(t + 5 * MIN));
    for (const sid of sids) expect(await valid(sid, s.ownerId, s.sellerId)).not.toBeNull();
    expect(await valid(opSid, op, s.sellerId)).not.toBeNull();
  });

  it("simultaneous sign-ins can't keep more devices than allowed", async () => {
    const s = await store("TRIAL");
    await Promise.all(Array.from({ length: 12 }, () => startSession({ userId: s.ownerId, sellerId: s.sellerId })));
    expect(await prisma.session.count({ where: { sellerId: s.sellerId, revokedAt: null } })).toBe(2);
  });

  it("an invited mobile signs into the inviting store: no store of its own, no trial spent", async () => {
    const s = await store();
    const m = mobile();
    const invited = await prisma.user.create({ data: { mobile: m } });
    await prisma.membership.create({ data: { sellerId: s.sellerId, userId: invited.id, role: "OPERATOR" } });

    const account = await accountForLogin(m);
    expect(account.userId).toBe(invited.id);
    expect(account.stores).toEqual([expect.objectContaining({ sellerId: s.sellerId, role: "OPERATOR" })]);
    expect(await prisma.seller.count({ where: { mobile: m } })).toBe(0);
    expect(await prisma.trialGrant.count({ where: { mobile: m } })).toBe(0);
  });

  it("a member of several stores gets them most recently used first", async () => {
    const own = await accountForLogin(mobile()); // a brand-new mobile: its own store, as before
    expect(own.stores).toHaveLength(1);
    expect(own.stores[0].role).toBe("OWNER");

    const other = await store();
    await prisma.membership.create({ data: { sellerId: other.sellerId, userId: own.userId, role: "OPERATOR" } });
    await signIn(own.userId, other.sellerId, new Date());

    const again = await accountForLogin(mobiles[mobiles.length - 2]);
    expect(again.stores.map((st) => st.sellerId)).toEqual([other.sellerId, own.stores[0].sellerId]);
  });
});
