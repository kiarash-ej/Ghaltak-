import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Colours come from the theme roles in globals.css: near-black in the light
// theme (checkout, login), the fire gradient in the dark dashboard.
const buttonVariants = cva(
  "gk-btn inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm transition-[background,color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-action hover:bg-action-hover",
        outline: "border border-line-strong bg-transparent text-ink hover:bg-raised-2",
        ghost: "text-ink hover:bg-raised-2",
        destructive: "bg-destructive text-white hover:bg-destructive-hover",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
