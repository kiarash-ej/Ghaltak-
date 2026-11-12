import { Bell } from "lucide-react";
import type { Metadata } from "next";
import { NotificationList } from "@/components/notifications/notification-list";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMember } from "@/server/auth";
import { listNotifications } from "@/server/notifications/seller-notifications";

export const metadata: Metadata = { title: "اعلان‌ها | غلتک" };

export default async function NotificationsPage() {
  const member = await requireMember();
  const items = await listNotifications(member.id, member.role);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="اعلان‌ها"
        description="سفارش تازه از لینک خرید، رسید کارت‌به‌کارت، پرداخت آنلاین و یادآوری اشتراک، همین‌جا و بدون پیامک."
      />
      {items.length === 0 ? (
        <EmptyState icon={Bell} title="هنوز اعلانی ندارید">
          وقتی مشتری با لینک خرید سفارش بدهد، رسید بفرستد یا آنلاین پرداخت کند، این‌جا خبردار می‌شوید.
        </EmptyState>
      ) : (
        <NotificationList items={items} />
      )}
    </div>
  );
}
