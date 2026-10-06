import { cookies } from "next/headers";
import Link from "next/link";
import { after } from "next/server";
import { AttentionList, attentionRows } from "@/components/dashboard/attention-list";
import { DailyBrief } from "@/components/home/daily-brief";
import { OnboardingChecklist } from "@/components/home/onboarding-checklist";
import { TodaySummary } from "@/components/home/today-summary";
import { formatDate, formatNumber } from "@/lib/format";
import { requireMember } from "@/server/auth";
import { getAttention } from "@/server/dashboard/attention";
import { getDailyBrief } from "@/server/dashboard/brief";
import { dismissBriefAction } from "@/server/dashboard/brief-actions";
import { BRIEF_COOKIE, greeting } from "@/server/dashboard/brief-text";
import { buildBriefView } from "@/server/dashboard/brief-view";
import { ensureRecurringExpenses } from "@/server/finance/expenses";
import { isOnboardingComplete, onboardingSteps } from "@/server/home/onboarding";
import { getOnboardingFacts, getTodaySummary } from "@/server/home/queries";
import { reportPeriods } from "@/server/reports/periods";
import { salesSince } from "@/server/reports/queries";

// Home (docs/superpowers/specs/2026-10-06-ghaltak-ui-finance-design.md §5):
// greeting, yesterday's brief (or the start checklist while it's incomplete),
// today's numbers, and what's waiting with the one action that clears it.

export default async function DashboardHome() {
  const seller = await requireMember();
  const isOwner = seller.role === "OWNER";
  const now = new Date();
  // This month's rows of monthly expenses (finance spec §6.1), after the response: Home shows no expenses yet.
  if (isOwner) after(() => ensureRecurringExpenses(seller.id, now));
  const [facts, summary, attention, brief, month, cookieStore] = await Promise.all([
    getOnboardingFacts(seller.id),
    getTodaySummary(seller.id, now),
    getAttention(seller.id),
    getDailyBrief(seller.id, now),
    isOwner ? salesSince(seller.id, reportPeriods(now).month) : null,
    cookies(),
  ]);
  const steps = onboardingSteps(facts);
  // Setting the store up is the owner's job (C5); it comes before the brief.
  const showChecklist = isOwner && !isOnboardingComplete(steps);
  const waiting = attentionRows(attention).length;

  // Built on the server per role: an operator's copy carries no money at all,
  // because the brief is a client component and its props reach the browser.
  const view = buildBriefView(brief, attention, seller.role);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex animate-rise flex-col gap-1">
        <h1 className="text-2xl font-black tracking-tight md:text-[1.75rem]">
          {greeting(now)}، {seller.name}
        </h1>
        <p className="text-sm text-muted">
          {formatDate(now)}
          {waiting > 0 && <> · {formatNumber(waiting)} کار منتظر شماست</>}
        </p>
      </header>

      {showChecklist ? (
        <OnboardingChecklist steps={steps} />
      ) : (
        brief.hasSales && (
          <DailyBrief
            view={view}
            initiallyFolded={cookieStore.get(BRIEF_COOKIE)?.value === brief.dayKey}
            dismiss={dismissBriefAction}
          />
        )
      )}

      <TodaySummary summary={summary} showMoney={isOwner} salesMonth={month?.total ?? 0} readyToShip={attention.readyToShip} />

      <section aria-labelledby="attention-heading" className="flex flex-col gap-3">
        <h2 id="attention-heading" className="text-lg font-extrabold">
          نیاز به رسیدگی
        </h2>
        <AttentionList counts={attention} />
      </section>

      <p className="text-sm text-muted">
        سؤالی دارید؟{" "}
        <Link href="/help" className="font-semibold text-ink underline underline-offset-4">
          راهنمای غلتک
        </Link>{" "}
        را ببینید.
      </p>
    </div>
  );
}
