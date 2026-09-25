import "server-only";
import { prisma } from "@/lib/prisma";
import type { MemberRole } from "@/generated/prisma/enums";
import { TRIAL_DAYS } from "@/server/billing/trial";

export const DEFAULT_STORE_NAME = "فروشگاه من";

/**
 * The seller account behind a login mobile, created on first login: a Seller,
 * a User with the same mobile, an OWNER membership and a subscription: the
 * 14-day TRIAL the first time this mobile ever signs up, FREE after that.
 *
 * Idempotent and safe when two logins for the same new mobile arrive at once:
 * every insert is INSERT ... ON CONFLICT DO NOTHING followed by a read, the
 * same pattern as #17. (Catching the unique-constraint error instead would
 * abort the whole transaction in Postgres.)
 */
export async function ensureSellerAccount(mobile: string): Promise<{ sellerId: string }> {
  return prisma.$transaction(async (tx) => {
    await tx.seller.createMany({ data: [{ mobile, name: DEFAULT_STORE_NAME }], skipDuplicates: true });
    const seller = await tx.seller.findUniqueOrThrow({ where: { mobile }, select: { id: true } });

    await tx.user.createMany({ data: [{ mobile }], skipDuplicates: true });
    const user = await tx.user.findUniqueOrThrow({ where: { mobile }, select: { id: true } });

    await tx.membership.createMany({
      data: [{ userId: user.id, sellerId: seller.id, role: "OWNER" }],
      skipDuplicates: true,
    });
    // The trial is once per mobile, ever (TrialGrant outlives the store). A
    // mobile that had it before starts on FREE. Only the transaction that
    // creates the subscription looks at the grant: a later login changes nothing.
    const hasSubscription = await tx.subscription.findUnique({ where: { sellerId: seller.id }, select: { id: true } });
    if (!hasSubscription) {
      const granted = await tx.trialGrant.createMany({ data: [{ mobile }], skipDuplicates: true });
      const trial = granted.count === 1;
      await tx.subscription.createMany({
        data: [
          {
            sellerId: seller.id,
            plan: trial ? "TRIAL" : "FREE",
            status: trial ? "TRIALING" : "ACTIVE",
            currentPeriodEnd: trial ? new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000) : new Date(),
          },
        ],
        skipDuplicates: true,
      });
    }

    return { sellerId: seller.id };
  });
}

export type StoreChoice = { sellerId: string; name: string; role: MemberRole; lastUsedAt: Date | null };
export type LoginAccount = { userId: string; stores: StoreChoice[] };

/**
 * Who is signing in with this mobile, and into which stores (A10). A mobile
 * that is already a member somewhere (e.g. invited as an operator) gets NO new
 * store, and so doesn't spend its trial; only a mobile with no membership at
 * all gets its own store, as before.
 *
 * Stores come most recently used first: the first one is signed into, and
 * with more than one the member can switch at /select-store.
 */
export async function accountForLogin(mobile: string): Promise<LoginAccount> {
  const existing = await prisma.user.findUnique({
    where: { mobile },
    select: { _count: { select: { memberships: true } } },
  });
  if (!existing || existing._count.memberships === 0) await ensureSellerAccount(mobile);

  const user = await prisma.user.findUniqueOrThrow({ where: { mobile }, select: { id: true } });
  return { userId: user.id, stores: await storesOf(user.id) };
}

/** The stores a user belongs to, most recently used first. */
export async function storesOf(userId: string): Promise<StoreChoice[]> {
  const [memberships, lastUsed] = await Promise.all([
    prisma.membership.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { sellerId: true, role: true, seller: { select: { name: true } } },
    }),
    prisma.session.groupBy({ by: ["sellerId"], where: { userId }, _max: { lastSeenAt: true } }),
  ]);
  const lastBySeller = new Map(lastUsed.map((r) => [r.sellerId, r._max.lastSeenAt]));
  return memberships
    .map((m) => ({ sellerId: m.sellerId, name: m.seller.name, role: m.role, lastUsedAt: lastBySeller.get(m.sellerId) ?? null }))
    .sort((a, b) => (b.lastUsedAt?.getTime() ?? 0) - (a.lastUsedAt?.getTime() ?? 0));
}
