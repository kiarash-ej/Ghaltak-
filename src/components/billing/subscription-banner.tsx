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
        banner.tone === "danger" ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900",
      )}
    >
      <p>{banner.text}</p>
      <Link href="/settings/billing" className="shrink-0 font-medium underline underline-offset-4">
        تمدید اشتراک
      </Link>
    </div>
  );
}
