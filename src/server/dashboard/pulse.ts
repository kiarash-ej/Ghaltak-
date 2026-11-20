import type { Attention } from "./attention";

// The dashboard's "pulse": one short string that changes whenever a badge or
// the bell would. The layout renders with the current one, and the open tab
// polls /api/dashboard/pulse and refreshes only when they differ
// (src/components/dashboard/auto-refresh.tsx). Pure, shared by both sides.

export function dashboardPulse(attention: Attention, unreadNotifications: number): string {
  return [attention.receipts, attention.readyToShip, attention.lowStock, unreadNotifications].join(".");
}
