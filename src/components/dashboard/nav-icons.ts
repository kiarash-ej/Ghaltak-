import { ChartLine, ClipboardList, House, Link2, Package, Settings, Users, type LucideIcon } from "lucide-react";
import type { NavKey } from "./nav-items";

export const NAV_ICONS: Record<NavKey, LucideIcon> = {
  home: House,
  orders: ClipboardList,
  products: Package,
  links: Link2,
  finance: ChartLine,
  customers: Users,
  settings: Settings,
};
