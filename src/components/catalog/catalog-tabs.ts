import type { NavTab } from "@/components/ui/nav-tabs";

// «محصولات | موجودی»: one nav entry, two views (spec §4.3).
export const CATALOG_TABS: NavTab[] = [
  { href: "/products", label: "محصولات" },
  { href: "/inventory", label: "موجودی" },
];
