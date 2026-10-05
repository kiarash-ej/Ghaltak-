"use client";

import { ArrowLeftRight, Bell, Link2, LogOut, Menu, Package, Plus, ShoppingBag } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/login/actions";
import { Sheet, SheetClose } from "@/components/ui/sheet";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AttentionList, attentionRows, type AttentionCounts } from "./attention-list";
import { NAV_ICONS } from "./nav-icons";
import { BUSINESS_NAV, PRIMARY_NAV, activeNavKey, type NavItem } from "./nav-items";
import { NavLink, type NavBadges } from "./sidebar";

const closeOnUse = (node: ReactNode) => <SheetClose asChild>{node}</SheetClose>;

const iconButton =
  "relative grid size-10 place-items-center rounded-xl border border-line bg-raised text-ink-soft transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";

/** Phone top bar (spec §4.2): logo, the bell (what's waiting) and ☰ (the rest). */
export function MobileTopBar({
  storeName,
  canSwitchStore,
  settingsHref,
  badges,
  attention,
}: {
  storeName: string;
  canSwitchStore: boolean;
  settingsHref: string;
  badges: NavBadges;
  attention: AttentionCounts;
}) {
  const active = activeNavKey(usePathname());
  const waiting = attentionRows(attention).length;
  const business = BUSINESS_NAV.map((i) => (i.key === "settings" ? { ...i, href: settingsHref } : i));

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-canvas/90 px-4 py-2.5 backdrop-blur md:hidden print:hidden">
      <Link href="/" className="flex min-w-0 items-center gap-2">
        <Image src="/brand/logo-symbol.png" alt="" width={34} height={34} priority />
        <span className="min-w-0">
          <span className="block text-base leading-tight font-black">غلتک</span>
          <span className="block truncate text-xs text-muted">{storeName}</span>
        </span>
      </Link>
      <div className="flex shrink-0 gap-2">
        <Sheet
          title="نیاز به رسیدگی"
          trigger={
            <button type="button" className={iconButton} aria-label={waiting > 0 ? `${formatNumber(waiting)} مورد نیاز به رسیدگی` : "نیاز به رسیدگی"}>
              <Bell className="size-5" aria-hidden />
              {waiting > 0 && <span aria-hidden className="absolute top-2 left-2 size-2 rounded-full bg-brand-2 ring-2 ring-raised" />}
            </button>
          }
        >
          <AttentionList counts={attention} wrap={closeOnUse} />
        </Sheet>
        <Sheet side="end" title="منو" trigger={<button type="button" className={iconButton} aria-label="منو"><Menu className="size-5" aria-hidden /></button>}>
          <nav aria-label="منوی کسب‌وکار" className="flex flex-col gap-1">
            {business.map((item) => (
              <SheetClose key={item.key} asChild>
                <NavLink item={item} active={active === item.key} badges={badges} />
              </SheetClose>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-1 border-t border-line pt-4">
            {canSwitchStore && (
              <SheetClose asChild>
                <Link href="/select-store" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-soft hover:bg-raised-2">
                  <ArrowLeftRight className="size-[18px] text-muted" aria-hidden />
                  تغییر فروشگاه
                </Link>
              </SheetClose>
            )}
            <form action={logoutAction}>
              <button type="submit" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-soft hover:bg-raised-2">
                <LogOut className="size-[18px] text-muted" aria-hidden />
                خروج
              </button>
            </form>
          </div>
        </Sheet>
      </div>
    </header>
  );
}

function TabLink({ item, active, count }: { item: NavItem; active: boolean; count: number }) {
  const Icon = NAV_ICONS[item.key];
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset",
        active ? "text-ink" : "text-muted",
      )}
    >
      {active && <span aria-hidden className="absolute top-0 h-[3px] w-7 rounded-b-full bg-fire" />}
      <span className="relative">
        <Icon className={cn("size-[22px]", active && "text-brand-2")} aria-hidden />
        {count > 0 && (
          <span className="absolute -top-1.5 -left-2.5 min-w-4 rounded-full bg-count px-1 text-center text-[10px] leading-4 text-white">
            {formatNumber(count)}
          </span>
        )}
      </span>
      {item.short ?? item.label}
    </Link>
  );
}

const QUICK_ACTIONS = [
  { href: "/orders/new", label: "سفارش جدید", hint: "سفارشی که در دایرکت گرفته‌اید", icon: ShoppingBag },
  { href: "/orders/links", label: "لینک خرید جدید", hint: "برای فرستادن در اینستاگرام و تلگرام", icon: Link2 },
  { href: "/products/new", label: "محصول جدید", hint: "با رنگ، سایز و موجودی", icon: Package },
];

/** Phone bottom bar (spec §4.2): four tabs with ➕ quick actions in the middle. */
export function BottomBar({ badges }: { badges: NavBadges }) {
  const active = activeNavKey(usePathname());
  const [home, orders, products, links] = PRIMARY_NAV;
  const count = (item: NavItem) => (item.badge ? badges[item.badge] : 0);

  return (
    <nav
      aria-label="منوی اصلی"
      className="fixed inset-x-0 bottom-0 z-30 grid h-[calc(4rem+env(safe-area-inset-bottom))] grid-cols-5 border-t border-line bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden print:hidden"
    >
      <TabLink item={home} active={active === "home"} count={0} />
      <TabLink item={orders} active={active === "orders"} count={count(orders)} />
      <div className="flex justify-center">
        <Sheet
          title="کار سریع"
          trigger={
            <button
              type="button"
              aria-label="کار سریع: سفارش، لینک یا محصول جدید"
              className="-mt-6 grid size-14 place-items-center rounded-2xl bg-fire text-white shadow-[0_10px_24px_-6px_rgb(232_40_63/0.7)] ring-4 ring-canvas transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-focus"
            >
              <Plus className="size-7" strokeWidth={2.6} aria-hidden />
            </button>
          }
        >
          <ul className="grid gap-2">
            {QUICK_ACTIONS.map((a, i) => (
              <li key={a.href} className="animate-rise" style={{ animationDelay: `${i * 60}ms` }}>
                <SheetClose asChild>
                  <Link
                    href={a.href}
                    className="flex items-center gap-3 rounded-2xl border border-line bg-raised p-3.5 transition-colors hover:bg-raised-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-fire text-white">
                      <a.icon className="size-5" aria-hidden />
                    </span>
                    <span>
                      <span className="block font-extrabold">{a.label}</span>
                      <span className="block text-sm text-muted">{a.hint}</span>
                    </span>
                  </Link>
                </SheetClose>
              </li>
            ))}
          </ul>
        </Sheet>
      </div>
      <TabLink item={products} active={active === "products"} count={count(products)} />
      <TabLink item={links} active={active === "links"} count={count(links)} />
    </nav>
  );
}
