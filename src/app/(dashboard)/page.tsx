import { cookies } from "next/headers";
import Link from "next/link";
import { AttentionList, attentionRows } from "@/components/dashboard/attention-list";
import { DailyBrief } from "@/components/home/daily-brief";
import { OnboardingChecklist } from "@/components/home/onboarding-checklist";
import { RecapCard } from "@/components/home/recap-card";
import { TodaySummary } from "@/components/home/today-summary";
import { formatDate, formatNumber } from "@/lib/format";
import { requireMember } from "@/server/auth";
import { getAttention } from "@/server/dashboard/attention";
import { getDailyBrief } from "@/server/dashboard/brief";
import { dismissBriefAction } from "@/server/dashboard/brief-actions";
import { BRIEF_COOKIE, RECAP_COOKIE, greeting } from "@/server/dashboard/brief-text";
import { buildBriefView } from "@/server/dashboard/brief-view";
import { ensureRecurringExpenses } from "@/server/finance/expenses";
import { recapFor } from "@/server/finance/report-periods";
import { getRecap } from "@/server/finance/reports";
import { getFinanceTotals } from "@/server/finance/summary";
import { isOnboardingComplete, onboardingSteps } from "@/server/home/onboarding";
import { getOnboardingFacts, getTodaySummary } from "@/server/home/queries";
import { reportPeriods, tehranMidnight } from "@/server/reports/periods";

// Home (docs/superpowers/specs/2026-10-06-ghaltak-ui-finance-design.md §5):
// greeting, yesterday's brief (or the start checklist while it's incomplete,
// or for the owner the recap of a month, season or year that just ended,
// §7.2), today's numbers, and what's waiting with the one action that clears it.

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function DashboardHome() {
  const seller = await requireMember();
  const isOwner = seller.role === "OWNER";
  const now = new Date();
  const today = tehranMidnight(now);
  // Monthly expenses get this month's rows first (finance spec §6.1): the profit below counts them.
  if (isOwner) await ensureRecurringExpenses(seller.id, now);
  const [facts, summary, attention, brief, month, yesterday, cookieStore] = await Promise.all([
    getOnboardingFacts(seller.id),
    getTodaySummary(seller.id, now),
    getAttention(seller.id),
    getDailyBrief(seller.id, now),
    // Money is the owner's (A10): not even loaded for an operator.
    isOwner ? getFinanceTotals(seller.id, reportPeriods(now).month, now) : null,
    isOwner ? getFinanceTotals(seller.id, new Date(today.getTime() - DAY_MS), today) : null,
    cookies(),
  ]);
  const steps = onboardingSteps(facts);
  // Setting the store up is the owner's job (C5); it comes before the brief.
  const showChecklist = isOwner && !isOnboardingComplete(steps);
  const waiting = attentionRows(attention).length;

  // Built on the server per role: an operator's copy carries no money at all,
  // because the brief is a client component and its props reach the browser.
  const view = buildBriefView(brief, attention, seller.role, yesterday);
  // The recap takes the brief's place, so it isn't loaded while the checklist holds that place.
  const ended = isOwner && !showChecklist && brief.hasSales ? recapFor(now) : null;
  const recap = ended && cookieStore.get(RECAP_COOKIE)?.value !== ended.period.key ? await getRecap(seller.id, ended) : null;

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
      ) : recap ? (
        <RecapCard recap={recap} />
      ) : (
        brief.hasSales && (
          <DailyBrief
            view={view}
            initiallyFolded={cookieStore.get(BRIEF_COOKIE)?.value === brief.dayKey}
            dismiss={dismissBriefAction}
          />
        )
      )}

      <TodaySummary
        summary={summary}
        showMoney={isOwner}
        salesMonth={month?.sales ?? 0}
        netMonth={month && month.coverage !== null && month.coverage >= 0.9 ? month.netProfit : null}
        readyToShip={attention.readyToShip}
      />

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
