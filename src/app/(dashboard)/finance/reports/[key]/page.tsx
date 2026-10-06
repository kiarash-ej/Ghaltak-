import { Printer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BarList } from "@/components/finance/bar-list";
import { InsightList } from "@/components/finance/insight-list";
import { ProfitBreakdown } from "@/components/finance/profit-breakdown";
import { ReportStory } from "@/components/finance/report-story";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { formatNumber, formatToman } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireOwner } from "@/server/auth";
import { compactToman } from "@/server/dashboard/brief-text";
import type { ProductProfitRow } from "@/server/finance/breakdowns";
import { compare, explain } from "@/server/finance/glossary";
import { parseReportKey } from "@/server/finance/report-periods";
import { getPeriodReport } from "@/server/finance/reports";
import { periodStory } from "@/server/finance/story";

// One finished period (spec §6.4): the story, the six numbers against the
// period before, where the money went, the period's advice, best products by
// sales and by profit, expenses by category, and «نسخهٔ چاپی». Computed live.
// The owner's only.

export async function generateMetadata(props: PageProps<"/finance/reports/[key]">): Promise<Metadata> {
  const period = parseReportKey((await props.params).key);
  return { title: `گزارش ${period?.label ?? ""} | غلتک` };
}

const pct = (r: number | null) => (r === null ? 0 : r);

function ProductTable({ rows, by }: { rows: ProductProfitRow[]; by: "sales" | "profit" }) {
  if (rows.length === 0) return <p className="text-sm text-muted">{by === "sales" ? "در این دوره فروشی نبود." : "برای محصولات فروخته‌شده قیمت خرید ثبت نشده است."}</p>;
  return (
    <table className="w-full text-sm">
      <thead className="text-muted">
        <tr>
          <th className="py-1.5 text-start font-medium">محصول</th>
          <th className="py-1.5 text-start font-medium">تعداد</th>
          <th className="py-1.5 text-end font-medium">{by === "sales" ? "فروش" : "سود ناخالص"}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.productId} className="border-t border-line">
            <td className="py-2.5 font-semibold">{p.name}</td>
            <td className="py-2.5 tabular-nums">{formatNumber(p.units)}</td>
            <td className={cn("py-2.5 text-end whitespace-nowrap tabular-nums", by === "profit" && (p.grossProfit ?? 0) < 0 && "text-danger")}>
              {formatToman(by === "sales" ? p.sales : (p.grossProfit ?? 0))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function PeriodReportPage(props: PageProps<"/finance/reports/[key]">) {
  const owner = await requireOwner();
  const { key } = await props.params;
  const period = parseReportKey(key);
  // Only periods that have ended: the archive lists nothing else.
  if (!period || period.to > new Date()) notFound();

  const report = await getPeriodReport(owner.id, period);
  const { current: t, before } = report;
  const against = report.previous.label;
  const sales = compactToman(t.sales);
  const net = compactToman(Math.abs(t.netProfit));
  const aov = compactToman(t.averageOrder ?? 0);
  const ex = (m: Parameters<typeof explain>[0]) => explain(m, t);
  const bySales = report.products.slice(0, 5);
  const byProfit = report.products
    .filter((p) => p.grossProfit !== null)
    .sort((a, b) => (b.grossProfit ?? 0) - (a.grossProfit ?? 0))
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`گزارش ${period.label}`}
        description={`مقایسه با ${against}. عددها همین حالا از روی سفارش‌ها و هزینه‌ها حساب شده‌اند.`}
        back={{ href: "/finance/reports", label: "گزارش‌ها" }}
        actions={
          <Link href={`/finance/reports/${period.key}/print`} className={cn(buttonVariants({ variant: "outline" }))}>
            <Printer className="size-4" aria-hidden /> نسخهٔ چاپی و PDF
          </Link>
        }
      />

      <ReportStory story={periodStory(period.label, against, t, before)} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat hero index={0} label="فروش" value={sales.value} decimals={sales.decimals} unit={sales.unit} delta={compare(t.sales, before.sales, "amount", against)} explain={ex("sales")} className="col-span-2 lg:col-span-1" />
        <Stat index={1} label={t.netProfit < 0 ? "زیان خالص" : "سود خالص"} value={net.value} decimals={net.decimals} unit={net.unit} delta={compare(t.netProfit, before.netProfit, "amount", against)} explain={ex("netProfit")} />
        <Stat index={2} label="حاشیهٔ سود" value={pct(t.margin)} style="percent" delta={compare(t.margin, before.margin, "rate", against)} explain={ex("margin")} />
        <Stat index={3} label="سفارش‌های پرداخت‌شده" value={t.saleOrders} delta={compare(t.saleOrders, before.saleOrders, "amount", against)} explain={ex("saleOrders")} />
        <Stat index={4} label="میانگین هر سفارش" value={aov.value} decimals={aov.decimals} unit={aov.unit} delta={compare(t.averageOrder, before.averageOrder, "amount", against)} explain={ex("averageOrder")} />
        <Stat index={5} label="نرخ مرجوعی" value={pct(t.returnRate)} style="percent" delta={compare(t.returnRate, before.returnRate, "badRate", against)} explain={ex("returnRate")} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>پول شما از کجا آمد و کجا رفت</CardTitle>
            <CardDescription>{period.label}</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfitBreakdown totals={t} />
          </CardContent>
        </Card>
        <Card className="min-w-0 lg:row-span-2">
          <CardHeader>
            <CardTitle>پیشنهادهای غلتک</CardTitle>
            <CardDescription>از روی همین دوره</CardDescription>
          </CardHeader>
          <CardContent>
            <InsightList insights={report.insights} />
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>هزینه‌ها به تفکیک</CardTitle>
            <CardDescription>جمع: {formatToman(t.expenses)}</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList
              empty="در این دوره هزینه‌ای ثبت نشده است."
              items={report.expenses.map((e) => ({ key: e.key, label: e.label, value: e.amount, display: formatToman(e.amount), sub: `${formatNumber(e.count)} مورد` }))}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>پرفروش‌ترین محصولات</CardTitle>
          </CardHeader>
          <CardContent>
            <ProductTable rows={bySales} by="sales" />
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>پرسودترین محصولات</CardTitle>
            <CardDescription>سود ناخالص: فروش منهای قیمت خرید</CardDescription>
          </CardHeader>
          <CardContent>
            <ProductTable rows={byProfit} by="profit" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
