import "server-only";
import { prisma } from "@/lib/prisma";
import { hasMemberSlotInTx } from "@/server/billing/usage";
import { revokeMemberSessions } from "@/server/sessions";

// Team members of a store (docs/phase2/specs/A10-team.md, section 4). Callers
// pass the sellerId from requireOwner(); nothing here checks the role.

export type InviteResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "ALREADY_MEMBER" | "LIMIT" };

/**
 * Adds `mobile` (normalized) to the store as an OPERATOR, at once: no accept
 * step. The plan's member limit is checked in the same transaction, with the
 * store's subscription row locked. The invite SMS is the caller's, after this
 * commits.
 */
export async function inviteMember(sellerId: string, mobile: string): Promise<InviteResult> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { mobile }, select: { id: true } });
    if (user) {
      const existing = await tx.membership.findUnique({
        where: { userId_sellerId: { userId: user.id, sellerId } },
        select: { id: true },
      });
      if (existing) return { ok: false, reason: "ALREADY_MEMBER" } as const;
    }
    if (!(await hasMemberSlotInTx(tx, sellerId))) return { ok: false, reason: "LIMIT" } as const;

    await tx.user.createMany({ data: [{ mobile }], skipDuplicates: true });
    const { id: userId } = await tx.user.findUniqueOrThrow({ where: { mobile }, select: { id: true } });
    const added = await tx.membership.createMany({
      data: [{ userId, sellerId, role: "OPERATOR" }],
      skipDuplicates: true,
    });
    if (added.count === 0) return { ok: false, reason: "ALREADY_MEMBER" } as const;
    return { ok: true, userId } as const;
  });
}

/**
 * Removes an operator and signs them out of every device in this store. The
 * owner can't be removed. Returns false if there was no such operator here.
 */
export async function removeMember(sellerId: string, userId: string): Promise<boolean> {
  const removed = await prisma.membership.deleteMany({ where: { sellerId, userId, role: "OPERATOR" } });
  if (removed.count === 0) return false;
  await revokeMemberSessions(sellerId, userId);
  return true;
}

export async function listMembers(sellerId: string) {
  const [members, devices] = await Promise.all([
    prisma.membership.findMany({
      where: { sellerId },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }], // OWNER first
      select: { userId: true, role: true, createdAt: true, user: { select: { mobile: true } } },
    }),
    prisma.session.groupBy({ by: ["userId"], where: { sellerId, revokedAt: null }, _count: { _all: true } }),
  ]);
  const deviceCount = new Map(devices.map((d) => [d.userId, d._count._all]));
  return members.map((m) => ({
    userId: m.userId,
    mobile: m.user.mobile,
    role: m.role,
    joinedAt: m.createdAt,
    devices: deviceCount.get(m.userId) ?? 0,
  }));
}
