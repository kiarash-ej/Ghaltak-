"use client";

import { useCallback, useState } from "react";

/**
 * The closest element carrying the theme (`data-app-theme`), for Radix
 * portals: rendered there, popovers and sheets get the dashboard's colours
 * instead of the light defaults on <body>. Put the returned ref on an element
 * next to the trigger.
 */
export function useThemeContainer<T extends HTMLElement>() {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const anchor = useCallback((node: T | null) => {
    setContainer(node?.closest<HTMLElement>("[data-app-theme]") ?? null);
  }, []);
  return [anchor, container] as const;
}
