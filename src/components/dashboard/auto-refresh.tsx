"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Keeps the badges and the bell current while the dashboard stays open: a new
 * order or receipt shows up within a minute without reloading. Only while the
 * tab is visible, and once more when the seller comes back to it. A refresh
 * re-reads the server data and keeps what is typed into forms.
 */
export function AutoRefresh({ everyMs = 60_000 }: { everyMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let last = Date.now();
    const refresh = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < everyMs) return;
      last = Date.now();
      router.refresh();
    };
    const timer = window.setInterval(refresh, everyMs);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, everyMs]);

  return null;
}
