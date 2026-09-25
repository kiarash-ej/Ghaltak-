import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import type { MemberRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { readSession } from "./session";
import { validateSession } from "./sessions";

export type CurrentSeller = { id: string; name: string; mobile: string };
export type CurrentMember = CurrentSeller & { userId: string; role: MemberRole; sessionId: string };

/**
 * The signed-in member of the current store, or a redirect: to /login without
 * a session, to /logout when the session is no longer valid (signed out
 * elsewhere, member removed, device limit, store deleted). /logout clears the
 * cookie; cookies can't be changed during a render, and without it the proxy
 * and this would send the browser back and forth.
 *
 * THIS is the only trusted source of `sellerId` and of the member's role.
 */
export const requireMember = cache(async (): Promise<CurrentMember> => {
  const cookie = await readSession();
  if (!cookie) redirect("/login");

  const session = await validateSession(cookie);
  if (!session) redirect("/logout");

  const seller = await prisma.seller.findUnique({
    where: { id: session.sellerId },
    select: { id: true, name: true, mobile: true },
  });
  if (!seller) redirect("/logout");

  return { ...seller, userId: session.userId, role: session.role, sessionId: session.sessionId };
});

/**
 * The current store, for every page and action any member may use. Same
 * result as before A10, so callers don't change; scope everything by its id,
 * never by an id sent from the client.
 */
export const requireSeller = cache(async (): Promise<CurrentSeller> => {
  const { id, name, mobile } = await requireMember();
  return { id, name, mobile };
});

/**
 * For the owner only: settings, payments, subscription, team, data export and
 * money figures' pages. An operator gets a 404, checked here on the server,
 * not by hiding a button (docs/phase2/specs/A10-team.md, section 1).
 */
export async function requireOwner(): Promise<CurrentMember> {
  const member = await requireMember();
  if (member.role !== "OWNER") notFound();
  return member;
}

/** Whether the current member may see money totals (sales in tomans, revenue). */
export async function canSeeFinancials(): Promise<boolean> {
  return (await requireMember()).role === "OWNER";
}
