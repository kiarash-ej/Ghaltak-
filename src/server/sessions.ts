import "server-only";
import type { MemberRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { PLANS } from "@/server/billing/plans";
import { getEffectivePlan } from "@/server/billing/usage";

// Signed-in devices in the database (docs/phase2/specs/A10-team.md, sections
// 2 and 5). No cookies here: ./session.ts reads and writes the cookie, this
// file decides what a session may do, so it can be tested on its own.
//
// Device limits, only while billing is enforced (BILLING_ENABLED):
// - FREE (the plan ended): the store keeps ONE device, the owner's newest.
//   Every other session is revoked as soon as a request sees it, and an
//   operator can't sign in at all (membership kept, back after renewal).
// - Trial and paid plans: devicesPerMember per person; a new sign-in over the
//   limit revokes that person's least recently used session.

/** lastSeenAt is written at most this often, not on every request. */
const TOUCH_MINUTES = 5;
const USER_AGENT_MAX = 200;

export type ValidSession = { sessionId: string; userId: string; sellerId: string; role: MemberRole };

/** Why a member can't get a session for a store. */
export type SignInRefusal = "NOT_A_MEMBER" | "PLAN_ENDED";

/** Operators can't work in a store whose plan ended (it fell to FREE). */
async function planAllows(sellerId: string, role: MemberRole, now: Date): Promise<boolean> {
  if (role === "OWNER") return true;
  const { effective } = await getEffectivePlan(sellerId, now);
  return !(effective.enforced && effective.state === "FREE");
}

/**
 * Creates a session for a member of a store, applying the device limit.
 * Holds the store's subscription row lock, so two sign-ins at once can't both
 * keep more devices than allowed.
 */
export async function startSession(input: {
  userId: string;
  sellerId: string;
  userAgent?: string | null;
  now?: Date;
}): Promise<{ ok: true; sessionId: string } | { ok: false; reason: SignInRefusal }> {
  const now = input.now ?? new Date();
  const membership = await prisma.membership.findUnique({
    where: { userId_sellerId: { userId: input.userId, sellerId: input.sellerId } },
    select: { role: true },
  });
  if (!membership) return { ok: false, reason: "NOT_A_MEMBER" };
  if (!(await planAllows(input.sellerId, membership.role, now))) return { ok: false, reason: "PLAN_ENDED" };

  const { effective } = await getEffectivePlan(input.sellerId, now);
  const sessionId = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Subscription" WHERE "sellerId" = ${input.sellerId} FOR UPDATE`;

    if (effective.enforced) {
      const free = effective.limitsPlan === "FREE";
      // FREE: this becomes the store's only device. Otherwise: keep the
      // person's newest (limit - 1) so that with this one they're at the limit.
      const keep = free ? 0 : PLANS[effective.limitsPlan].limits.devicesPerMember - 1;
      const active = await tx.session.findMany({
        where: { sellerId: input.sellerId, revokedAt: null, ...(free ? {} : { userId: input.userId }) },
        orderBy: { lastSeenAt: "desc" },
        select: { id: true },
      });
      const revoke = active.slice(keep).map((s) => s.id);
      if (revoke.length > 0) {
        await tx.session.updateMany({ where: { id: { in: revoke } }, data: { revokedAt: now } });
      }
    }

    const created = await tx.session.create({
      data: {
        userId: input.userId,
        sellerId: input.sellerId,
        userAgent: input.userAgent?.slice(0, USER_AGENT_MAX) || null,
        createdAt: now,
        lastSeenAt: now,
      },
      select: { id: true },
    });
    return created.id;
  });
  return { ok: true, sessionId };
}

/**
 * The session behind a cookie, or null when it must sign in again: unknown,
 * revoked, not matching the cookie, membership removed, an operator in a store
 * whose plan ended, or not the owner's one device on FREE.
 */
export async function validateSession(
  cookie: { sid: string; userId: string; sellerId: string },
  now: Date = new Date(),
): Promise<ValidSession | null> {
  const session = await prisma.session.findUnique({
    where: { id: cookie.sid },
    select: { id: true, userId: true, sellerId: true, revokedAt: true, lastSeenAt: true },
  });
  if (!session || session.revokedAt || session.userId !== cookie.userId || session.sellerId !== cookie.sellerId) {
    return null;
  }
  const membership = await prisma.membership.findUnique({
    where: { userId_sellerId: { userId: session.userId, sellerId: session.sellerId } },
    select: { role: true },
  });
  if (!membership) {
    await revokeSession(session.id, now);
    return null;
  }

  const { effective } = await getEffectivePlan(session.sellerId, now);
  if (effective.enforced && effective.state === "FREE") {
    if (membership.role !== "OWNER") {
      await revokeSession(session.id, now);
      return null;
    }
    if (!(await keepOnlyOwnersNewest(session.sellerId, session.userId, session.id, now))) return null;
  }

  if (now.getTime() - session.lastSeenAt.getTime() > TOUCH_MINUTES * 60 * 1000) {
    await prisma.session.updateMany({ where: { id: session.id, revokedAt: null }, data: { lastSeenAt: now } });
  }
  return { sessionId: session.id, userId: session.userId, sellerId: session.sellerId, role: membership.role };
}

/**
 * The plan ended: the store keeps only the owner's most recently used session.
 * Returns whether `sessionId` is that one. Cheap when there's nothing to do.
 */
async function keepOnlyOwnersNewest(sellerId: string, ownerId: string, sessionId: string, now: Date): Promise<boolean> {
  const active = await prisma.session.findMany({
    where: { sellerId, revokedAt: null },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, userId: true },
  });
  const keep = active.find((s) => s.userId === ownerId);
  const revoke = active.filter((s) => s.id !== keep?.id).map((s) => s.id);
  if (revoke.length > 0) {
    await prisma.session.updateMany({ where: { id: { in: revoke }, revokedAt: null }, data: { revokedAt: now } });
  }
  return keep?.id === sessionId;
}

export async function revokeSession(sessionId: string, now: Date = new Date()): Promise<void> {
  await prisma.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: now } });
}

/** Signs a person out of every device in one store (member removed, «خروج از همهٔ دستگاه‌ها»). */
export async function revokeMemberSessions(
  sellerId: string,
  userId: string,
  opts: { except?: string; now?: Date } = {},
): Promise<number> {
  const r = await prisma.session.updateMany({
    where: { sellerId, userId, revokedAt: null, ...(opts.except ? { id: { not: opts.except } } : {}) },
    data: { revokedAt: opts.now ?? new Date() },
  });
  return r.count;
}

/** A person's signed-in devices in one store, most recently used first. */
export function listMemberSessions(sellerId: string, userId: string) {
  return prisma.session.findMany({
    where: { sellerId, userId, revokedAt: null },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, userAgent: true, createdAt: true, lastSeenAt: true },
  });
}
