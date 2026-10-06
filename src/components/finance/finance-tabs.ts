import type { NavTab } from "@/components/ui/nav-tabs";

// The finance section's tabs (spec §6.4). Grows as the steps land: Sales,
// Product profit, Expenses and Period reports come next. Until the Sales tab
// is rebuilt, «فروش» is the existing sales report.
export const FINANCE_TABS: NavTab[] = [
  { href: "/finance", label: "خلاصه" },
  { href: "/reports", label: "فروش" },
];
