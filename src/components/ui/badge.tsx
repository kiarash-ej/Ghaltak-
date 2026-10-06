import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        neutral: "bg-info-bg text-info",
        success: "bg-success-bg text-success",
        warning: "bg-warning-bg text-warning",
        danger: "bg-danger-bg text-danger",
        /** A number in the navigation: how many things are waiting. */
        count: "min-w-5 justify-center bg-count px-1.5 font-bold text-white tabular-nums",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
