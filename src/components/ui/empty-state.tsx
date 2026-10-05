import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Nothing here yet: one sentence and the one thing to do about it. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex animate-rise flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center",
        className,
      )}
    >
      <span className="grid size-12 place-items-center rounded-2xl bg-raised-2 text-brand-2">
        <Icon className="size-6" aria-hidden />
      </span>
      <p className="font-bold">{title}</p>
      {children && <div className="max-w-sm text-sm leading-7 text-muted">{children}</div>}
      {action}
    </div>
  );
}
