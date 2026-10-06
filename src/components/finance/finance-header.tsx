import { NavTabs } from "@/components/ui/nav-tabs";
import { PageHeader } from "@/components/ui/page-header";
import type { FinanceRange, PeriodError } from "@/server/finance/periods";
import { financeTabs } from "./finance-tabs";
import { PeriodBar } from "./period-bar";

/** The top of every finance tab: title, the tabs, the period chips (spec §6.4). */
export function FinanceHeader({
  basePath,
  range,
  error,
  isOwner,
}: {
  basePath: string;
  range: FinanceRange;
  error?: PeriodError;
  isOwner: boolean;
}) {
  return (
    <>
      <PageHeader title="مالی و گزارش" description={`${range.label} · مقایسه با ${range.compareLabel}`} />
      <NavTabs label="بخش‌های مالی" tabs={financeTabs(isOwner)} />
      <PeriodBar basePath={basePath} range={range} error={error} />
    </>
  );
}
