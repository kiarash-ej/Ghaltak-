import { cn } from "@/lib/utils";

/** A loading placeholder in the shape of what's coming. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-xl bg-raised-2", className)} />;
}
