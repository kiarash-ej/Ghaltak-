import type { Metadata } from "next";
import { StoreProfileForm } from "@/components/settings/store-profile-form";
import { requireSeller } from "@/server/auth";
import { updateStoreProfileAction } from "@/server/store/actions";
import { getPublicStoreProfile } from "@/server/store/profile";

export const metadata: Metadata = { title: "تنظیمات فروشگاه | غلتک" };

export default async function StoreSettingsPage() {
  const seller = await requireSeller();
  const profile = await getPublicStoreProfile(seller.id);
  // requireSeller() just found this seller.
  if (!profile) throw new Error("seller disappeared");

  return <StoreProfileForm action={updateStoreProfileAction} initial={profile} />;
}
