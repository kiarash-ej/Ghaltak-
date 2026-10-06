import { NavTabs } from "@/components/ui/nav-tabs";
import { PageHeader } from "@/components/ui/page-header";
import type { FinanceRange, PeriodError } from "@/server/finance/periods";
import { financeTabs } from "./finance-tabs";
import { PeriodBar } from "./period-bar";

/** The top of every finance tab: title, the tabs, and (with a range) the period chips (spec §6.4). */
export function FinanceHeader({
  isOwner,
  period,
  description,
}: {
  isOwner: boolean;
  period?: { basePath: string; range: FinanceRange; error?: PeriodError };
  description?: string;
}) {
  return (
    <>
      <PageHeader
        title="مالی و گزارش"
        description={description ?? (period && `${period.range.label} · مقایسه با ${period.range.compareLabel}`)}
      />
      <NavTabs label="بخش‌های مالی" tabs={financeTabs(isOwner)} />
      {period && <PeriodBar basePath={period.basePath} range={period.range} error={period.error} />}
    </>
  );
}
