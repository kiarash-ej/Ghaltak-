"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { normalizeIranMobile } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireMember, requireOwner } from "@/server/auth";
import { createSession } from "@/server/session";
import { revokeMemberSessions, revokeSession } from "@/server/sessions";
import { sendSms } from "@/server/sms/send";
import { inviteMember, removeMember } from "./members";

// Team and devices (A10). Team actions are the owner's only, checked here on
// the server (requireOwner); device actions only ever touch the caller's own
// sessions.

export type InviteState = { ok?: boolean; error?: string } | undefined;

export async function inviteMemberAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const owner = await requireOwner();
  const mobile = normalizeIranMobile(String(formData.get("mobile") ?? ""));
  if (!mobile) return { error: "شماره موبایل معتبر نیست. مثال: ۰۹۱۲۱۲۳۴۵۶۷" };

  const result = await inviteMember(owner.id, mobile);
  if (!result.ok) {
    return {
      error:
        result.reason === "LIMIT"
          ? "به سقف اعضای پلن خود رسیده‌اید. برای افزودن عضو، پلن را از «اشتراک» ارتقا دهید."
          : "این شماره از قبل عضو فروشگاه است.",
    };
  }
  // After the response: the membership is committed, and a failed SMS never
  // undoes it (sendSms never throws).
  after(() => sendSms({ sellerId: owner.id, to: mobile, kind: "MEMBER_INVITE", tokens: [owner.name] }));
  revalidatePath("/settings/team");
  return { ok: true };
}

export async function removeMemberAction(userId: string): Promise<void> {
  const owner = await requireOwner();
  await removeMember(owner.id, userId);
  revalidatePath("/settings/team");
}

/** «خروج از همهٔ دستگاه‌ها» for a member (the owner may do it for anyone in the store, themselves too). */
export async function signOutMemberAction(userId: string): Promise<void> {
  const owner = await requireOwner();
  const isMember = await prisma.membership.findUnique({
    where: { userId_sellerId: { userId, sellerId: owner.id } },
    select: { id: true },
  });
  if (!isMember) return;
  // The owner signing themselves out everywhere keeps this device.
  await revokeMemberSessions(owner.id, userId, userId === owner.userId ? { except: owner.sessionId } : {});
  revalidatePath("/settings/team");
}

/** Signs one of the caller's OWN devices out (not this one: that's «خروج»). */
export async function signOutDeviceAction(sessionId: string): Promise<void> {
  const me = await requireMember();
  if (sessionId === me.sessionId) return;
  const own = await prisma.session.findFirst({
    where: { id: sessionId, userId: me.userId, sellerId: me.id },
    select: { id: true },
  });
  if (own) await revokeSession(own.id);
  revalidatePath("/settings/devices");
}

export async function signOutOtherDevicesAction(): Promise<void> {
  const me = await requireMember();
  await revokeMemberSessions(me.id, me.userId, { except: me.sessionId });
  revalidatePath("/settings/devices");
}

export type SwitchStoreState = { error?: string } | undefined;

/** /select-store: this device moves to another store the member belongs to. */
export async function switchStoreAction(sellerId: string): Promise<SwitchStoreState> {
  const me = await requireMember();
  if (sellerId === me.id) redirect("/");
  const started = await createSession(me.userId, sellerId); // checks the membership and the plan
  if (!started.ok) {
    return {
      error:
        started.reason === "PLAN_ENDED"
          ? "اشتراک این فروشگاه تمام شده است. به مالک فروشگاه اطلاع دهید."
          : "به این فروشگاه دسترسی ندارید.",
    };
  }
  await revokeSession(me.sessionId);
  redirect("/");
}
