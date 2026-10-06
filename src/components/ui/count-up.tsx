"use client";

import { useLayoutEffect, useRef } from "react";

// A number that counts up from zero when it first appears (spec §3.5).
//
// The server renders the final value, so it's right without JavaScript, for
// screen readers (aria-label) and when motion is reduced. With JavaScript, a
// CSS rule in globals.css keeps the number hidden until this runs, so it
// never flashes its final value and then drops to zero; if the script is slow
// the number shows anyway after a second, and this then leaves it alone.

const DURATION_MS = 1100;

export function formatCount(value: number, decimals = 0, style: "number" | "percent" = "number"): string {
  return new Intl.NumberFormat("fa-IR", {
    style: style === "percent" ? "percent" : "decimal",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function CountUp({
  value,
  decimals = 0,
  style = "number",
  className,
}: {
  value: number;
  decimals?: number;
  /** "percent": 0.37 → ۳۷٪ */
  style?: "number" | "percent";
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const final = formatCount(value, decimals, style);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const done = () => el.setAttribute("data-countup-done", "");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Already revealed by the 1 s fallback: the moment has passed.
    const alreadyShown = getComputedStyle(el).opacity === "1" && !el.hasAttribute("data-countup-done");
    if (reduced || alreadyShown || value === 0) {
      el.textContent = final;
      done();
      return;
    }

    el.textContent = formatCount(0, decimals, style);
    done();
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = p < 1 ? formatCount(value * eased, decimals, style) : final;
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      el.textContent = final;
    };
  }, [value, decimals, style, final]);

  return (
    <span ref={ref} data-countup="" aria-label={final} className={className}>
      {final}
    </span>
  );
}
