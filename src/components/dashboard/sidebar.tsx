"use client";

import { ArrowLeftRight, LogOut } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentPropsWithRef } from "react";
import { logoutAction } from "@/app/login/actions";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { NAV_ICONS } from "./nav-icons";
import { BUSINESS_NAV, PRIMARY_NAV, activeNavKey, type NavItem } from "./nav-items";

export type NavBadges = { orders: number; stock: number };

/** One sidebar entry: icon, label, waiting-count badge; the active one glows. */
export function NavLink({
  item,
  active,
  badges,
  className,
  ...rest
}: {
  item: NavItem;
  active: boolean;
  badges: NavBadges;
} & Omit<ComponentPropsWithRef<"a">, "href">) {
  const Icon = NAV_ICONS[item.key];
  const count = item.badge ? badges[item.badge] : 0;
  return (
    <Link
      {...rest}
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
        active
          ? "bg-[linear-gradient(270deg,rgb(255_90_31/0.2),rgb(232_40_63/0.08)_70%,transparent)] text-ink shadow-[inset_-3px_0_0_var(--gk-brand-2)]"
          : "text-ink-soft hover:bg-raised-2 hover:text-ink",
        className,
      )}
    >
      <Icon className={cn("size-[18px] shrink-0", active ? "text-brand-2" : "text-muted group-hover:text-ink")} aria-hidden />
      <span className="flex-1">{item.label}</span>
      {count > 0 && (
        <Badge variant="count" aria-label={`${formatNumber(count)} مورد منتظر`}>
          {formatNumber(count)}
        </Badge>
      )}
    </Link>
  );
}

/** Desktop navigation (spec §4.1): logo, store, the handiest pages, then «کسب‌وکار». */
export function Sidebar({
  storeName,
  canSwitchStore,
  settingsHref,
  badges,
}: {
  storeName: string;
  canSwitchStore: boolean;
  settingsHref: string;
  badges: NavBadges;
}) {
  const active = activeNavKey(usePathname());
  const business = BUSINESS_NAV.map((i) => (i.key === "settings" ? { ...i, href: settingsHref } : i));

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-1 overflow-y-auto border-e border-line bg-sidebar p-4 md:flex print:hidden">
      <Link href="/" className="mb-1 flex items-center gap-2.5 rounded-xl px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
        <Image src="/brand/logo-symbol.png" alt="" width={42} height={42} priority />
        <span className="text-xl font-black tracking-tight">غلتک</span>
      </Link>
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <span className="truncate text-sm text-muted">{storeName}</span>
        {canSwitchStore && (
          <Link
            href="/select-store"
            className="flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-0.5 text-xs font-semibold text-muted hover:bg-raised-2 hover:text-ink"
          >
            <ArrowLeftRight className="size-3.5" aria-hidden />
            تغییر فروشگاه
          </Link>
        )}
      </div>

      <nav aria-label="منوی اصلی" className="flex flex-col gap-1">
        {PRIMARY_NAV.map((item) => (
          <NavLink key={item.key} item={item} active={active === item.key} badges={badges} />
        ))}
        <p className="mt-4 mb-1 px-3 text-xs font-bold text-faint">کسب‌وکار</p>
        {business.map((item) => (
          <NavLink key={item.key} item={item} active={active === item.key} badges={badges} />
        ))}
      </nav>

      <form action={logoutAction} className="mt-auto pt-4">
        <button
          type="submit"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted hover:bg-raised-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <LogOut className="size-[18px]" aria-hidden />
          خروج
        </button>
      </form>
    </aside>
  );
}
