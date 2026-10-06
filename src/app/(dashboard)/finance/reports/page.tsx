import { ChevronLeft, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FinanceHeader } from "@/components/finance/finance-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireOwner } from "@/server/auth";
import { compactToman } from "@/server/dashboard/brief-text";
import { getReportArchive, type ArchiveRow } from "@/server/finance/reports";

// «گزارش‌ها» (spec §6.4): every finished month, season and year since the
// store's first order, newest first, each with its sales and net profit and
// a link to its report (with a printable copy). The owner's only.

export const metadata: Metadata = { title: "گزارش‌های دوره‌ای | مالی و گزارش | غلتک" };

const amount = (v: number) => {
  const c = compactToman(Math.abs(v));
  return `${formatNumber(c.value)} ${c.unit}`;
};

function ArchiveList({ rows }: { rows: ArchiveRow[] }) {
  return (
    <ul className="flex flex-col divide-y divide-line">
      {rows.map((r, i) => (
        <li key={r.key} className="animate-rise" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
          <Link
            href={`/finance/reports/${r.key}`}
            className="group flex items-center gap-3 rounded-lg py-3 text-sm transition-colors hover:bg-raised-2/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <span className="min-w-0 flex-1 font-bold whitespace-nowrap">{r.label}</span>
            <span className="flex flex-col items-end gap-0.5 text-end">
              <span className="whitespace-nowrap tabular-nums">
                <span className="text-xs text-muted">فروش </span>
                {amount(r.sales)}
              </span>
              <span className={cn("whitespace-nowrap tabular-nums", r.net < 0 ? "text-danger" : "text-success")}>
                <span className="text-xs text-muted">{r.net < 0 ? "زیان " : "سود خالص "}</span>
                {amount(r.net)}
              </span>
            </span>
            <ChevronLeft className="size-4 shrink-0 text-muted transition-transform group-hover:-translate-x-0.5" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function ReportsArchivePage() {
  const owner = await requireOwner();
  const archive = await getReportArchive(owner.id);
  const sections = [
    { title: "سال‌ها", rows: archive.year },
    { title: "فصل‌ها", rows: archive.season },
    { title: "ماه‌ها", rows: archive.month },
  ].filter((s) => s.rows.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <FinanceHeader isOwner description="گزارش هر ماه، فصل و سال تمام‌شده، با نسخهٔ چاپی و PDF." />
      {sections.length === 0 ? (
        <EmptyState icon={FileText} title="هنوز دوره‌ای تمام نشده است">
          گزارش هر ماه، فصل و سال بعد از تمام شدنش اینجا می‌آید، از ماهی که اولین سفارش را ثبت کردید.
        </EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr] lg:items-start">
          {sections.map((s) => (
            // Wide screens: months down one side, years and seasons beside them. Phones: years first.
            <Card key={s.title} className={cn("min-w-0", s.title === "ماه‌ها" ? "lg:col-start-1 lg:row-span-2 lg:row-start-1" : "lg:col-start-2")}>
              <CardHeader>
                <CardTitle>{s.title}</CardTitle>
                <CardDescription>فروش و سود خالص، تازه‌ترین بالا</CardDescription>
              </CardHeader>
              <CardContent>
                <ArchiveList rows={s.rows} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
