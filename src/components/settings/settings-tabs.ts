// Tabs of the settings page. Owned by Track A; Track B owns the «پرداخت» tab's
// page (src/app/(dashboard)/settings/payments/**).

export type SettingsTab = { href: string; label: string };

export const SETTINGS_TABS: SettingsTab[] = [
  { href: "/settings", label: "فروشگاه" }, // A6
  { href: "/settings/payments", label: "پرداخت" }, // B6, B7 (Track B)
  { href: "/settings/billing", label: "اشتراک" }, // A9
  { href: "/settings/team", label: "اعضا" }, // A10
];
