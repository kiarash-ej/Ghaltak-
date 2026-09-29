"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { PUBLIC_THEME_KEY } from "@/lib/public-theme";
import styles from "@/app/marketing.module.css";

type Theme = "light" | "dark";
const CHANGE_EVENT = "ghaltak-public-theme-change";
// Retain the choice within this document if storage access is blocked.
let memoryPreference: Theme | null = null;

function preference(): Theme | null {
  if (memoryPreference) return memoryPreference;
  try {
    const value = localStorage.getItem(PUBLIC_THEME_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function apply(theme: Theme) {
  document.documentElement.dataset.publicTheme = theme;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  const media = matchMedia("(prefers-color-scheme: dark)");
  const sync = () => apply(preference() ?? (media.matches ? "dark" : "light"));
  const onStorage = (event: StorageEvent) => {
    if (event.key !== PUBLIC_THEME_KEY && event.key !== null) return;
    memoryPreference = null;
    sync();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  media.addEventListener("change", sync);
  sync();
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
    media.removeEventListener("change", sync);
  };
}

const getSnapshot = () => document.documentElement.dataset.publicTheme === "dark";
const getServerSnapshot = () => false;

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const toggle = () => {
    const next = getSnapshot() ? "light" : "dark";
    memoryPreference = next;
    try {
      localStorage.setItem(PUBLIC_THEME_KEY, next);
      memoryPreference = null;
    } catch {
      // The button remains usable when browser storage is unavailable.
    }
    apply(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={styles.themeToggle}
      aria-label="حالت تیره"
      aria-pressed={dark}
      title={dark ? "تغییر به حالت روشن" : "تغییر به حالت تیره"}
    >
      <Moon className={styles.themeMoon} size={20} aria-hidden="true" />
      <Sun className={styles.themeSun} size={20} aria-hidden="true" />
    </button>
  );
}
