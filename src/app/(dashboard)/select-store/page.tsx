import type { Metadata } from "next";
import { SwitchStoreButton } from "@/components/team/switch-store-button";
import { requireMember } from "@/server/auth";
import { storesOf } from "@/server/account";
import { switchStoreAction } from "@/server/team/actions";
import { PageHeader } from "@/components/ui/page-header";

// Choosing a store (A10): after signing in with more than one membership, and
// from «تغییر فروشگاه» in the sidebar.

export const metadata: Metadata = { title: "انتخاب فروشگاه | غلتک" };

export default async function SelectStorePage() {
  const me = await requireMember();
  const stores = await storesOf(me.userId);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <PageHeader title="انتخاب فروشگاه" description="شما عضو چند فروشگاه هستید. می‌خواهید وارد کدام شوید؟" />
      <div className="flex flex-col gap-2">
        {stores.map((s) => (
          <SwitchStoreButton
            key={s.sellerId}
            action={switchStoreAction.bind(null, s.sellerId)}
            label={`${s.name} (${s.role === "OWNER" ? "مالک" : "اپراتور"})`}
            current={s.sellerId === me.id}
          />
        ))}
      </div>
    </div>
  );
}
