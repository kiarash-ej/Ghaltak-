import "server-only";
import type { MemberRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { CurrentSeller } from "@/server/auth";

// Who may export (Phase 2, C6): only the store's OWNER. An OPERATOR (A10) may
// not, and this is checked on the server, never only by hiding the button.
//
// Until A10's requireMember() exists, a session is a seller and the person
// logged in is the one with the seller's login mobile, so their role is that
// user's membership in this store. When A10 lands, replace loginRole() with
// the role from requireMember().

export function canExport(role: MemberRole | null): boolean {
  return role === "OWNER";
}

export async function loginRole(seller: Pick<CurrentSeller, "id" | "mobile">): Promise<MemberRole | null> {
  const membership = await prisma.membership.findFirst({
    where: { sellerId: seller.id, user: { mobile: seller.mobile } },
    select: { role: true },
  });
  return membership?.role ?? null;
}
