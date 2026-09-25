import Link from "next/link";
import { OnboardingChecklist } from "@/components/home/onboarding-checklist";
import { TodaySummary } from "@/components/home/today-summary";
import { requireSeller } from "@/server/auth";
import { isOnboardingComplete, onboardingSteps } from "@/server/home/onboarding";
import { getOnboardingFacts, getTodaySummary } from "@/server/home/queries";

export default async function DashboardHome() {
  const seller = await requireSeller();
  const [facts, summary] = await Promise.all([getOnboardingFacts(seller.id), getTodaySummary(seller.id)]);
  const steps = onboardingSteps(facts);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">خوش آمدید، {seller.name}</h1>
        <p className="text-neutral-600">
          از منوی کناری محصولات، مشتریان و سفارش‌های خود را مدیریت کنید.
        </p>
      </div>

      {/* Replaces A6's "complete your store" notice: that is now step 1. */}
      {!isOnboardingComplete(steps) && <OnboardingChecklist steps={steps} />}

      <TodaySummary summary={summary} />

      <p className="text-sm text-neutral-600">
        سؤالی دارید؟{" "}
        <Link href="/help" className="font-medium text-neutral-900 underline underline-offset-4">
          راهنمای غلتک
        </Link>{" "}
        را ببینید.
      </p>
    </div>
  );
}
