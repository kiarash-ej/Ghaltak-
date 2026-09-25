// Tabs of the settings page. Owned by Track A; Track B owns the «پرداخت» tab's
// page (src/app/(dashboard)/settings/payments/**) and Track C the «خروجی داده»
// tab's (src/app/(dashboard)/settings/data/**).
// `ownerOnly` tabs are hidden from operators; their pages ALSO refuse them on
// the server (requireOwner), hiding is only for convenience (A10).

export type SettingsTab = { href: string; label: string; ownerOnly: boolean };

export const SETTINGS_TABS: SettingsTab[] = [
  { href: "/settings", label: "فروشگاه", ownerOnly: true }, // A6
  { href: "/settings/payments", label: "پرداخت", ownerOnly: true }, // B6, B7 (Track B)
  { href: "/settings/billing", label: "اشتراک", ownerOnly: true }, // A9
  { href: "/settings/team", label: "اعضا", ownerOnly: true }, // A10
  { href: "/settings/data", label: "خروجی داده", ownerOnly: true }, // C6 (Track C)
  { href: "/settings/devices", label: "دستگاه‌های من", ownerOnly: false }, // A10
];

export function settingsTabsFor(role: "OWNER" | "OPERATOR"): SettingsTab[] {
  return role === "OWNER" ? SETTINGS_TABS : SETTINGS_TABS.filter((t) => !t.ownerOnly);
}

/** Where «تنظیمات» in the sidebar goes: an operator has no «فروشگاه» tab. */
export function settingsHomeFor(role: "OWNER" | "OPERATOR"): string {
  return settingsTabsFor(role)[0].href;
}
