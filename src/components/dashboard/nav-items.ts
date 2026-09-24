// Sidebar entries. Each track adds its own pages; keep the order stable so
// the two tracks rarely touch the same lines (append within your own group).

export type NavItem = { href: string; label: string };

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "داشبورد" },
  // Track A — catalog
  { href: "/products", label: "محصولات" },
  { href: "/inventory", label: "موجودی" },
  { href: "/customers", label: "مشتریان" },
  // Track B — sales
  { href: "/orders", label: "سفارش‌ها" },
  { href: "/reports", label: "گزارش فروش" },
];
