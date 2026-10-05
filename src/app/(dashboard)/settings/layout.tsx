import { SettingsNav } from "@/components/settings/settings-nav";
import { settingsTabsFor } from "@/components/settings/settings-tabs";
import { requireMember } from "@/server/auth";
import { PageHeader } from "@/components/ui/page-header";

export default async function SettingsLayout({ children }: LayoutProps<"/settings">) {
  const member = await requireMember();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="تنظیمات" />
      <SettingsNav tabs={settingsTabsFor(member.role)} />
      {children}
    </div>
  );
}
