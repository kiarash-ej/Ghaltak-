import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Banner } from "@/server/billing/banner";

/** The subscription warning above the dashboard (A9). */
export function SubscriptionBanner({ banner }: { banner: Banner }) {
  return (
    <div
      role="status"
      className={cn(
        "mb-4 flex flex-col print:hidden gap-2 rounded-lg border p-3 text-sm sm:flex-row sm:items-center sm:justify-between",
        banner.tone === "danger" ? "border-danger/30 bg-danger-bg text-danger" : "border-warning/30 bg-warning-bg text-warning",
      )}
    >
      <p>{banner.text}</p>
      <Link href="/settings/billing" className="shrink-0 font-medium underline underline-offset-4">
        تمدید اشتراک
      </Link>
    </div>
  );
}
