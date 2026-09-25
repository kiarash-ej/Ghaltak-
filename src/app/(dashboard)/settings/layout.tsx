import { SettingsNav } from "@/components/settings/settings-nav";
import { settingsTabsFor } from "@/components/settings/settings-tabs";
import { requireMember } from "@/server/auth";

export default async function SettingsLayout({ children }: LayoutProps<"/settings">) {
  const member = await requireMember();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">تنظیمات</h1>
      <SettingsNav tabs={settingsTabsFor(member.role)} />
      {children}
    </div>
  );
}
