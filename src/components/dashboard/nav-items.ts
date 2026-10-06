// The dashboard's navigation (docs/superpowers/specs/2026-10-06-ghaltak-ui-finance-design.md §4).
// The handiest pages come first: on phones these four sit in the bottom bar.
// The rest are under «کسب‌وکار» in the sidebar and in the ☰ menu on phones.

export type NavKey = "home" | "orders" | "products" | "links" | "finance" | "customers" | "settings";

export type NavItem = {
  key: NavKey;
  href: string;
  label: string;
  /** Shorter label for the phone bottom bar. */
  short?: string;
  /** Path prefixes that belong to this entry. */
  match: string[];
  /** Which waiting-count badge it shows (src/server/dashboard/attention.ts). */
  badge?: "orders" | "stock";
};

export const PRIMARY_NAV: NavItem[] = [
  { key: "home", href: "/", label: "خانه", match: ["/"] },
  { key: "orders", href: "/orders", label: "سفارش‌ها", match: ["/orders"], badge: "orders" },
  {
    key: "products",
    href: "/products",
    label: "محصولات و موجودی",
    short: "محصولات",
    match: ["/products", "/inventory"],
    badge: "stock",
  },
  { key: "links", href: "/orders/links", label: "لینک‌های خرید", short: "لینک‌ها", match: ["/orders/links"] },
];

export const BUSINESS_NAV: NavItem[] = [
  { key: "finance", href: "/finance", label: "مالی و گزارش", match: ["/reports", "/finance"] },
  { key: "customers", href: "/customers", label: "مشتریان", match: ["/customers"] },
  { key: "settings", href: "/settings", label: "تنظیمات", match: ["/settings"] },
];

/** The entry for `pathname`: the longest matching prefix wins ("/" only matches itself). */
export function activeNavKey(pathname: string): NavKey | null {
  let best: { key: NavKey; length: number } | null = null;
  for (const item of [...PRIMARY_NAV, ...BUSINESS_NAV]) {
    for (const prefix of item.match) {
      const hit = prefix === "/" ? pathname === "/" : pathname === prefix || pathname.startsWith(`${prefix}/`);
      if (hit && (!best || prefix.length > best.length)) best = { key: item.key, length: prefix.length };
    }
  }
  return best?.key ?? null;
}
