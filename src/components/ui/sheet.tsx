"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useThemeContainer } from "./theme-container";

/**
 * A panel over the page: from the bottom on phones (the ➕ quick actions),
 * or from the inline end as a drawer (the ☰ menu). Radix Dialog handles focus
 * trapping, Escape and returning focus to the trigger.
 */
export function Sheet({
  trigger,
  title,
  side = "bottom",
  open,
  onOpenChange,
  children,
}: {
  trigger: ReactNode;
  title: string;
  side?: "bottom" | "end";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const [anchor, container] = useThemeContainer<HTMLSpanElement>();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <span ref={anchor} className="contents">
        <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      </span>
      <Dialog.Portal container={container}>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade" />
        <Dialog.Content
          className={cn(
            "fixed z-50 flex flex-col gap-4 border-line bg-sidebar p-5 text-ink shadow-2xl focus:outline-none",
            side === "bottom"
              ? "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-3xl border-t pb-[max(1.25rem,env(safe-area-inset-bottom))] data-[state=closed]:animate-sheet-down data-[state=open]:animate-sheet-up"
              : "inset-y-0 end-0 w-80 max-w-[85vw] border-s data-[state=closed]:animate-drawer-out data-[state=open]:animate-drawer-in",
          )}
        >
          {side === "bottom" && <div aria-hidden className="mx-auto h-1.5 w-10 rounded-full bg-line-strong" />}
          <div className="flex items-center justify-between gap-3">
            <Dialog.Title className="text-base font-extrabold">{title}</Dialog.Title>
            <Dialog.Close
              aria-label="بستن"
              className="grid size-9 place-items-center rounded-xl text-muted hover:bg-raised-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">{title}</Dialog.Description>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Wrap a link or button inside a sheet so using it also closes the sheet. */
export const SheetClose = Dialog.Close;
