import type { Metadata } from "next";
import { SwitchStoreButton } from "@/components/team/switch-store-button";
import { requireMember } from "@/server/auth";
import { storesOf } from "@/server/account";
import { switchStoreAction } from "@/server/team/actions";

// Choosing a store (A10): after signing in with more than one membership, and
// from «تغییر فروشگاه» in the sidebar.

export const metadata: Metadata = { title: "انتخاب فروشگاه | غلتک" };

export default async function SelectStorePage() {
  const me = await requireMember();
  const stores = await storesOf(me.userId);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h1 className="text-2xl font-bold">انتخاب فروشگاه</h1>
      <p className="text-neutral-600">شما عضو چند فروشگاه هستید. در کدام کار می‌کنید؟</p>
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
