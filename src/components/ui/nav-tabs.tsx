"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type NavTab = { href: string; label: string; /** match sub-paths too (default: exact) */ prefix?: boolean };

/**
 * Tabs that are pages (finance tabs, products | stock). The highlight slides
 * to the active tab (spec §3.5). Plain links underneath, so they work without
 * JavaScript and are announced as the current page.
 */
export function NavTabs({ tabs, label, className }: { tabs: NavTab[]; label: string; className?: string }) {
  const pathname = usePathname();
  const active = tabs.findIndex((t) => (t.prefix ? pathname === t.href || pathname.startsWith(`${t.href}/`) : pathname === t.href));
  const list = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = list.current?.querySelector<HTMLElement>('[aria-current="page"]');
      setBox(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (list.current) ro.observe(list.current);
    return () => ro.disconnect();
  }, [active]);

  return (
    <nav aria-label={label} className={cn("relative max-w-full overflow-x-auto", className)}>
      <div ref={list} className="relative flex w-max gap-1 rounded-xl border border-line bg-sidebar p-1">
        {box && (
          <span
            aria-hidden
            className="absolute top-1 bottom-1 rounded-lg bg-raised-2 shadow-[inset_0_-2px_0_var(--gk-brand-2)] transition-[left,width] duration-300 ease-(--gk-ease)"
            style={{ left: box.left, width: box.width }}
          />
        )}
        {tabs.map((t, i) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={i === active ? "page" : undefined}
            className={cn(
              "relative z-10 rounded-lg px-3.5 py-1.5 text-sm font-bold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
              i === active ? "text-ink" : "text-muted hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
