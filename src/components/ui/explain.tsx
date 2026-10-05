"use client";

import * as Popover from "@radix-ui/react-popover";
import type { ReactNode } from "react";
import { useThemeContainer } from "./theme-container";

/**
 * The ؟ next to a number: what it means, in plain Persian (spec §6.6). A
 * button, so it works by keyboard and screen reader; the text is the
 * glossary's, often with the store's own figure in it.
 */
export function Explain({ title, children }: { title: string; children: ReactNode }) {
  const [anchor, container] = useThemeContainer<HTMLButtonElement>();

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          ref={anchor}
          type="button"
          aria-label={`${title}: توضیح`}
          className="inline-grid size-5 shrink-0 place-items-center rounded-full border border-line-strong text-[11px] leading-none font-bold text-muted transition-colors hover:border-focus hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus data-[state=open]:border-focus data-[state=open]:text-ink"
        >
          ؟
        </button>
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="z-50 w-72 max-w-[calc(100vw-24px)] rounded-xl bg-ink p-3 text-sm leading-7 text-canvas shadow-2xl data-[state=closed]:animate-fade-out data-[state=open]:animate-pop"
        >
          <p className="font-bold">{title}</p>
          <div>{children}</div>
          <Popover.Arrow className="fill-ink" width={14} height={7} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
