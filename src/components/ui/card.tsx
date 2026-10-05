import * as React from "react";
import { cn } from "@/lib/utils";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  /** `hero`: the brand glow, for the one number that matters most on a page. */
  variant?: "default" | "hero";
};

export function Card({ className, variant = "default", ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border text-ink shadow-(--gk-shadow)",
        variant === "hero" ? "relative overflow-hidden border-brand-2/35 bg-glow" : "border-line bg-raised",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 p-6", className)} {...props} />;
}

/**
 * An h2 by default: a card usually sits right under the page's h1, and a
 * skipped level breaks the outline a screen reader shows (#52). A card inside
 * a section that has its own h2 passes `as="h3"`. Same look either way.
 */
export function CardTitle({
  as: Heading = "h2",
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { as?: "h2" | "h3" }) {
  return <Heading className={cn("text-lg font-semibold leading-none", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}
