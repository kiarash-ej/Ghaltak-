import { SubscriptionBanner } from "@/components/billing/subscription-banner";
import { BottomBar, MobileTopBar } from "@/components/dashboard/mobile-bars";
import { Sidebar } from "@/components/dashboard/sidebar";
import { settingsHomeFor } from "@/components/settings/settings-tabs";
import { JsMarker } from "@/components/ui/js-marker";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/server/auth";
import { subscriptionBanner } from "@/server/billing/banner";
import { scheduleSubscriptionReminder } from "@/server/billing/reminder";
import { getEffectivePlan } from "@/server/billing/usage";
import { getAttention, ordersWaiting } from "@/server/dashboard/attention";

// The seller dashboard's frame (docs/superpowers/specs/2026-10-06-ghaltak-ui-finance-design.md §4):
// dark theme, sidebar on desktop, top bar + bottom bar on phones.

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  const seller = await requireMember();
  const now = new Date();
  const [{ stored, effective }, storeCount, attention] = await Promise.all([
    getEffectivePlan(seller.id, now),
    prisma.membership.count({ where: { userId: seller.userId } }),
    getAttention(seller.id),
  ]);
  // The subscription is the owner's business: operators don't see its warnings.
  const banner = seller.role === "OWNER" ? subscriptionBanner(stored.plan, effective, now) : null;
  scheduleSubscriptionReminder(seller.id);

  const settingsHref = settingsHomeFor(seller.role);
  const badges = { orders: ordersWaiting(attention), stock: attention.lowStock };
  const canSwitchStore = storeCount > 1;

  return (
    <div data-app-theme="dark" className="flex min-h-dvh flex-1 flex-col overflow-x-clip md:flex-row print:block">
      <JsMarker />
      <Sidebar storeName={seller.name} canSwitchStore={canSwitchStore} settingsHref={settingsHref} badges={badges} />
      <MobileTopBar
        storeName={seller.name}
        canSwitchStore={canSwitchStore}
        settingsHref={settingsHref}
        badges={badges}
        attention={attention}
      />
      <main className="mx-auto w-full max-w-6xl min-w-0 flex-1 px-4 pt-5 pb-28 md:px-8 md:pt-8 md:pb-10 print:max-w-none print:p-0">
        {banner && <SubscriptionBanner banner={banner} />}
        {children}
      </main>
      <BottomBar badges={badges} />
    </div>
  );
}
