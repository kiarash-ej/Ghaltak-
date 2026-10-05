import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The top of every dashboard page (spec §8): optional way back, title,
 * one-line description, actions. The primary action goes last in `actions`
 * (it lands at the far end); actions the phone already has in the bottom bar
 * or ➕ can be marked `max-md:hidden` by the page.
 */
export function PageHeader({
  title,
  description,
  back,
  actions,
  badge,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Where "back" goes; the arrow points right, the way back in Persian. */
  back?: { href: string; label: string };
  actions?: ReactNode;
  /** Shown next to the title, e.g. the order's status. */
  badge?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex animate-rise flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div className="flex min-w-0 flex-col gap-1.5">
        {back && (
          <Link
            href={back.href}
            className="flex w-fit items-center gap-1.5 rounded-lg text-sm font-semibold text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <ArrowRight className="size-4" aria-hidden />
            {back.label}
          </Link>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h1 className="text-2xl font-black tracking-tight md:text-[1.75rem]">{title}</h1>
          {badge}
        </div>
        {description && <div className="text-sm leading-7 text-muted">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:justify-end">{actions}</div>}
    </header>
  );
}
