import type { Metadata } from "next";
import { StoreProfileForm } from "@/components/settings/store-profile-form";
import { redirect } from "next/navigation";
import { settingsHomeFor } from "@/components/settings/settings-tabs";
import { requireMember } from "@/server/auth";
import { updateStoreProfileAction } from "@/server/store/actions";
import { getPublicStoreProfile } from "@/server/store/profile";

export const metadata: Metadata = { title: "تنظیمات فروشگاه | غلتک" };

export default async function StoreSettingsPage() {
  const seller = await requireMember();
  // Store settings are the owner's; an operator lands on their own tab instead (A10).
  if (seller.role !== "OWNER") redirect(settingsHomeFor(seller.role));
  const profile = await getPublicStoreProfile(seller.id);
  // requireMember() just found this seller.
  if (!profile) throw new Error("seller disappeared");

  return <StoreProfileForm action={updateStoreProfileAction} initial={profile} />;
}
