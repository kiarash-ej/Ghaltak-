import Image from "next/image";
import Link from "next/link";
import { SubscriptionBanner } from "@/components/billing/subscription-banner";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/login/actions";
import { settingsHomeFor } from "@/components/settings/settings-tabs";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/server/auth";
import { subscriptionBanner } from "@/server/billing/banner";
import { scheduleSubscriptionReminder } from "@/server/billing/reminder";
import { getEffectivePlan } from "@/server/billing/usage";

export default async function DashboardLayout({
  children,
}: LayoutProps<"/">) {
  const seller = await requireMember();
  const now = new Date();
  const [{ stored, effective }, storeCount] = await Promise.all([
    getEffectivePlan(seller.id, now),
    prisma.membership.count({ where: { userId: seller.userId } }),
  ]);
  // The subscription is the owner's business: operators don't see its warnings.
  const banner = seller.role === "OWNER" ? subscriptionBanner(stored.plan, effective, now) : null;
  scheduleSubscriptionReminder(seller.id);

  return (
    <div className="flex flex-1 flex-col md:flex-row print:block">
      <aside className="flex flex-col gap-4 border-b border-neutral-200 p-4 md:w-60 md:border-b-0 md:border-e print:hidden">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/brand/logo-symbol.png" alt="" width={40} height={40} priority />
          <div>
            <div className="text-lg font-bold">غلتک</div>
            <div className="text-sm text-neutral-500">{seller.name}</div>
          </div>
        </Link>
        {storeCount > 1 && (
          <Link href="/select-store" className="text-sm text-neutral-600 underline underline-offset-4">
            تغییر فروشگاه
          </Link>
        )}
        <SidebarNav settingsHref={settingsHomeFor(seller.role)} />
        <form action={logoutAction} className="md:mt-auto">
          <Button type="submit" variant="ghost" size="sm" className="w-full">
            خروج
          </Button>
        </form>
      </aside>
      <main className="flex-1 p-4 md:p-8 print:p-0">
        {banner && <SubscriptionBanner banner={banner} />}
        {children}
      </main>
    </div>
  );
}
