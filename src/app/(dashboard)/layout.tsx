import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/login/actions";
import { requireSeller } from "@/server/auth";

export default async function DashboardLayout({
  children,
}: LayoutProps<"/">) {
  const seller = await requireSeller();

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="flex flex-col gap-4 border-b border-neutral-200 p-4 md:w-60 md:border-b-0 md:border-e">
        <div>
          <div className="text-lg font-bold">غلتک</div>
          <div className="text-sm text-neutral-500">{seller.name}</div>
        </div>
        <SidebarNav />
        <form action={logoutAction} className="md:mt-auto">
          <Button type="submit" variant="ghost" size="sm" className="w-full">
            خروج
          </Button>
        </form>
      </aside>
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
