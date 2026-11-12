"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/server/auth";
import { markNotificationsRead } from "./seller-notifications";

/** Called when the member opens «اعلان‌ها»: clears the unread count everywhere. */
export async function markNotificationsReadAction(): Promise<void> {
  const member = await requireMember();
  const changed = await markNotificationsRead(member.id, member.role);
  if (changed > 0) revalidatePath("/", "layout");
}
