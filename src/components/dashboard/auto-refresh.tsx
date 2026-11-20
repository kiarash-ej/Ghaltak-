"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Keeps the badges and the bell current while the dashboard stays open: a new
 * order or receipt shows up within a minute without reloading.
 *
 * It does NOT call router.refresh() on a timer. A refresh whose request fails
 * (weak signal, a deploy in progress) makes Next fall back to a full page
 * load, which throws away whatever the seller was typing. So the tab polls a
 * tiny endpoint with its own fetch, where a failure is simply ignored, and
 * refreshes only when that request succeeded AND the counts differ from what
 * is on screen. Only while the tab is visible and online.
 */
export function AutoRefresh({ pulse, everyMs = 60_000 }: { pulse: string; everyMs?: number }) {
  const router = useRouter();
  // What is on screen now, and the last value a refresh was asked for (so one
  // change never asks twice, even if that refresh didn't change the screen).
  const shown = useRef(pulse);
  const asked = useRef(pulse);
  useEffect(() => {
    shown.current = pulse;
  }, [pulse]);

  useEffect(() => {
    let last = Date.now();
    let busy = false;

    const check = async () => {
      if (busy || document.visibilityState !== "visible" || !navigator.onLine) return;
      // Half the interval: enough to stop the timer and a "tab is visible again"
      // event doubling up, without skipping a tick that fires a few ms early.
      if (Date.now() - last < everyMs / 2) return;
      last = Date.now();
      busy = true;
      try {
        const res = await fetch("/api/dashboard/pulse", { cache: "no-store", redirect: "manual" });
        if (!res.ok) return;
        const body: unknown = await res.json();
        const next = (body as { pulse?: unknown } | null)?.pulse;
        if (typeof next !== "string" || next === shown.current || next === asked.current) return;
        asked.current = next;
        router.refresh();
      } catch {
        // Offline or the server is restarting: try again next time.
      } finally {
        busy = false;
      }
    };

    const timer = window.setInterval(check, everyMs);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [router, everyMs]);

  return null;
}
