import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  type,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        "h-10 w-full rounded-lg border border-line-strong bg-transparent px-3 text-sm text-ink placeholder:text-faint focus-visible:border-focus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40 disabled:opacity-50 aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}
