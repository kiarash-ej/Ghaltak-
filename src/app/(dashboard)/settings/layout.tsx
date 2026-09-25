import { SettingsNav } from "@/components/settings/settings-nav";
import { requireSeller } from "@/server/auth";

export default async function SettingsLayout({ children }: LayoutProps<"/settings">) {
  await requireSeller();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">تنظیمات</h1>
      <SettingsNav />
      {children}
    </div>
  );
}
