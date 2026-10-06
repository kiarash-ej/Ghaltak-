import type { NavTab } from "@/components/ui/nav-tabs";

// The finance section's tabs (spec §6.4). Product profit and Expenses are the
// owner's (their routes are a 404 for operators); period reports come next.
export function financeTabs(isOwner: boolean): NavTab[] {
  const tabs: NavTab[] = [
    { href: "/finance", label: "خلاصه" },
    { href: "/finance/sales", label: "فروش" },
  ];
  if (!isOwner) return tabs;
  return [...tabs, { href: "/finance/products", label: "سود محصولات" }, { href: "/finance/expenses", label: "هزینه‌ها" }];
}
