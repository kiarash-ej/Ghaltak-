import type { Metadata } from "next";
import { ComingSoon } from "@/components/settings/coming-soon";

export const metadata: Metadata = { title: "اعضا | غلتک" };

export default function TeamSettingsPage() {
  return <ComingSoon title="اعضای تیم" task="A10" />;
}
