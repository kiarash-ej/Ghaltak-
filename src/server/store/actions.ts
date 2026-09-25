"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSeller } from "@/server/auth";
import { deleteStoreLogo, saveStoreLogo } from "./logo";
import type { PublicStoreProfile } from "./profile";
import { parseStoreProfileForm, type FieldErrors } from "./profile-form";

export type StoreProfileFormState =
  | {
      errors?: FieldErrors;
      message?: string;
      /** After a successful save: the profile as stored, and when. */
      saved?: PublicStoreProfile;
      savedAt?: number;
    }
  | undefined;

const GENERIC_ERROR = "خطای غیرمنتظره‌ای رخ داد. دوباره تلاش کنید.";

/** Saves the store's public profile (/settings, "فروشگاه" tab). */
export async function updateStoreProfileAction(
  _prev: StoreProfileFormState,
  formData: FormData,
): Promise<StoreProfileFormState> {
  const seller = await requireSeller();

  const parsed = parseStoreProfileForm(formData);
  if (!parsed.success) return { errors: parsed.errors };

  let newLogoUrl: string | null = null;
  const file = formData.get("logo");
  if (file instanceof File && file.size > 0) {
    const saved = await saveStoreLogo(file);
    if (!saved.ok) return { errors: { logo: [saved.error] } };
    newLogoUrl = saved.url;
  }
  const changesLogo = newLogoUrl !== null || formData.get("removeLogo") === "on";

  let oldLogoUrl: string | null;
  try {
    oldLogoUrl = await prisma.$transaction(async (tx) => {
      // Row lock: with two saves at once, each deletes exactly the logo it replaced.
      const [row] = await tx.$queryRaw<{ logoUrl: string | null }[]>`
        SELECT "logoUrl" FROM "Seller" WHERE "id" = ${seller.id} FOR UPDATE`;
      await tx.seller.update({
        where: { id: seller.id },
        // The logo column is written only when it changes, never from a stale read.
        data: { ...parsed.data, ...(changesLogo ? { logoUrl: newLogoUrl } : {}) },
      });
      return row?.logoUrl ?? null;
    });
  } catch (err) {
    await deleteStoreLogo(newLogoUrl);
    console.error("store profile save failed", err);
    return { message: GENERIC_ERROR };
  }

  if (changesLogo && oldLogoUrl && oldLogoUrl !== newLogoUrl) {
    await deleteStoreLogo(oldLogoUrl);
  }

  // The name is on every dashboard page (sidebar) and on the public pages.
  revalidatePath("/", "layout");
  return {
    saved: { ...parsed.data, logoUrl: changesLogo ? newLogoUrl : oldLogoUrl },
    savedAt: Date.now(),
  };
}
