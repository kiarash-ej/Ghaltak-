import "server-only";
import { prisma } from "@/lib/prisma";
import { TRIAL_DAYS } from "@/server/billing/trial";

export const DEFAULT_STORE_NAME = "فروشگاه من";

/**
 * The seller account behind a login mobile, created on first login: a Seller,
 * a User with the same mobile, an OWNER membership and a TRIAL subscription.
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
    await tx.subscription.createMany({
      data: [
        {
          sellerId: seller.id,
          plan: "TRIAL",
          status: "TRIALING",
          currentPeriodEnd: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
        },
      ],
      skipDuplicates: true,
    });

    return { sellerId: seller.id };
  });
}
