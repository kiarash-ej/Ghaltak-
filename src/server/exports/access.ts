import "server-only";
import type { MemberRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { CurrentSeller } from "@/server/auth";
import { readSession } from "@/server/session";

// Who may export (Phase 2, C6): only the store's OWNER. An OPERATOR (A10) may
// not, and this is checked on the server, never only by hiding the button.
//
// Correct both before and after A10 (#57), whichever merges first:
// - After A10 the session cookie carries the signed-in user's id, and an
//   operator signs in with their OWN mobile. The role must come from that
//   user's membership. (The store's `mobile` is still the owner's, so looking
//   the role up by it would call every operator an owner.)
// - Before A10 a session is just a store, and the person signed in is the one
//   with the store's login mobile.
// Once A10 is in, this can become `requireOwner()`.

export function canExport(role: MemberRole | null): boolean {
  return role === "OWNER";
}

/** Role in the store of a user, given by id (A10 sessions) or by login mobile (before A10). */
export async function roleIn(sellerId: string, who: { userId: string } | { mobile: string }): Promise<MemberRole | null> {
  const membership = await prisma.membership.findFirst({
    where: "userId" in who ? { sellerId, userId: who.userId } : { sellerId, user: { mobile: who.mobile } },
    select: { role: true },
  });
  return membership?.role ?? null;
}

/** The signed-in person's role in the store that requireSeller() returned. */
export async function currentRole(seller: Pick<CurrentSeller, "id" | "mobile">): Promise<MemberRole | null> {
  const session = await readSession();
  const userId = (session as { userId?: unknown } | null)?.userId;
  return roleIn(seller.id, typeof userId === "string" ? { userId } : { mobile: seller.mobile });
}
