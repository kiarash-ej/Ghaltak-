"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// The public header's submenus («امکانات», «راهنما»): a button that shows a
// list of links, and on phones one «منو» button with every group. Closes on a
// click outside, on Escape (focus back on the button) and when a link is chosen.

export type NavLink = { href: string; label: string; description?: string };
export type NavGroup = { label: string; links: NavLink[] };

function Chevron({ open }: { open: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={cn("size-4 transition-transform", open && "rotate-180")}>
      <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Open state that closes on a click outside `root` or on Escape. */
function useDisclosure() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return { open, setOpen, root, button };
}

function LinkList({ links, onPick }: { links: NavLink[]; onPick: () => void }) {
  return (
    <ul className="flex flex-col">
      {links.map((l) => (
        <li key={l.href}>
          <Link
            href={l.href}
            onClick={onPick}
            className="flex flex-col gap-0.5 rounded-lg px-3 py-2 hover:bg-neutral-100 focus-visible:bg-neutral-100"
          >
            <span className="text-sm font-medium text-neutral-900">{l.label}</span>
            {l.description && <span className="text-xs leading-5 text-neutral-500">{l.description}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** One submenu in the desktop header. */
export function NavMenu({ group }: { group: NavGroup }) {
  const { open, setOpen, root, button } = useDisclosure();
  const panel = useId();

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
      >
        {group.label}
        <Chevron open={open} />
      </button>
      {open && (
        <div
          id={panel}
          className="absolute start-0 top-full z-20 mt-1 w-72 rounded-xl border border-neutral-200 bg-white p-2 shadow-lg"
        >
          <LinkList links={group.links} onPick={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

/** Every group behind one «منو» button, for phones. */
export function MobileMenu({ groups, extra }: { groups: NavGroup[]; extra: NavLink[] }) {
  const { open, setOpen, root, button } = useDisclosure();
  const panel = useId();

  return (
    <div ref={root} className="md:hidden">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
      >
        منو
        <Chevron open={open} />
      </button>
      {open && (
        <div
          id={panel}
          className="absolute inset-x-0 top-full z-20 max-h-[75vh] overflow-y-auto border-b border-neutral-200 bg-white px-4 pb-4 shadow-lg"
        >
          {groups.map((g) => (
            <div key={g.label} className="flex flex-col gap-1 border-b border-neutral-100 py-3">
              <p className="px-3 text-xs font-semibold text-neutral-500">{g.label}</p>
              <LinkList links={g.links} onPick={() => setOpen(false)} />
            </div>
          ))}
          <div className="pt-3">
            <LinkList links={extra} onPick={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
