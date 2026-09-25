"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/server/auth";

export type SmsSettingsState = { savedAt?: number; message?: string } | undefined;

/** Which customer SMS this seller sends («پرداخت» tab, B7). */
export async function saveSmsSettingsAction(
  _prev: SmsSettingsState,
  formData: FormData,
): Promise<SmsSettingsState> {
  const seller = await requireOwner();
  await prisma.seller.update({
    where: { id: seller.id },
    data: {
      smsOnOrderPlaced: formData.get("smsOnOrderPlaced") === "on",
      smsOnPaid: formData.get("smsOnPaid") === "on",
      smsOnShipped: formData.get("smsOnShipped") === "on",
    },
  });
  revalidatePath("/settings/payments");
  return { savedAt: Date.now() };
}
