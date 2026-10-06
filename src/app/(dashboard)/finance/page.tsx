import type { Metadata } from "next";
import Link from "next/link";
import { FinanceChart } from "@/components/finance/finance-chart";
import { FinanceHeader } from "@/components/finance/finance-header";
import { InsightList } from "@/components/finance/insight-list";
import { ProfitBreakdown } from "@/components/finance/profit-breakdown";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { formatNumber, formatToman } from "@/lib/format";
import { requireMember } from "@/server/auth";
import { compactToman } from "@/server/dashboard/brief-text";
import { ensureRecurringExpenses } from "@/server/finance/expenses";
import { compare, explain } from "@/server/finance/glossary";
import { advise } from "@/server/finance/insights";
import { loadInsightFacts } from "@/server/finance/insights/facts";
import { resolveFinanceRange } from "@/server/finance/periods";
import { getFinanceSeries, getFinanceTotals, getUnpaid } from "@/server/finance/summary";
import { expireUnpaidLinkOrders } from "@/server/orders/expire-orders";

// Finance overview (docs/superpowers/specs/2026-10-06-ghaltak-ui-finance-design.md §6.4,
// layout B): six headline numbers with ؟, the daily chart, advice, where the
// money went. The owner sees money; an operator sees counts only, and only counts
// are ever passed to a client component on their page (A10).

export const metadata: Metadata = { title: "مالی و گزارش | غلتک" };

const pct = (r: number | null) => (r === null ? 0 : r);

export default async function FinancePage(props: PageProps<"/finance">) {
  const member = await requireMember();
  const now = new Date();
  const { range, error } = resolveFinanceRange(await props.searchParams, now);
  const isOwner = member.role === "OWNER";
  // Monthly repeats are made into this month's expense rows lazily (spec §6.1).
  if (isOwner) await ensureRecurringExpenses(member.id, now);

  const [totals, before] = await Promise.all([
    getFinanceTotals(member.id, range.from, range.to),
    getFinanceTotals(member.id, range.previous.from, range.previous.to),
  ]);
  const against = range.compareLabel;

  const header = <FinanceHeader basePath="/finance" range={range} error={error} isOwner={isOwner} />;

  if (!isOwner) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat index={0} label="سفارش‌های ثبت‌شده" value={totals.ordersPlaced} delta={compare(totals.ordersPlaced, before.ordersPlaced, "amount", against)} />
          <Stat index={1} label="سفارش‌های پرداخت‌شده" value={totals.saleOrders} delta={compare(totals.saleOrders, before.saleOrders, "amount", against)} />
          <Stat index={2} label="نرخ مرجوعی" value={pct(totals.returnRate)} style="percent" delta={compare(totals.returnRate, before.returnRate, "badRate", against)} />
          <Stat index={3} label="نرخ لغو" value={pct(totals.cancelRate)} style="percent" delta={compare(totals.cancelRate, before.cancelRate, "badRate", against)} />
        </div>
        <p className="text-sm text-muted">مبلغ فروش، سود و هزینه‌ها را فقط مالک فروشگاه می‌بیند.</p>
      </div>
    );
  }

  // Abandoned purchase-link orders are canceled lazily (as on /orders), so
  // "unpaid" and its advice don't count orders that have already expired.
  await expireUnpaidLinkOrders(member.id, now);
  const [series, unpaid, facts] = await Promise.all([
    getFinanceSeries(member.id, range.from, range.to),
    getUnpaid(member.id),
    loadInsightFacts(member.id, range, { current: totals, previous: before }, now),
  ]);
  const insights = advise(facts);
  const sales = compactToman(totals.sales);
  const net = compactToman(Math.abs(totals.netProfit));
  const aov = compactToman(totals.averageOrder ?? 0);
  const partial = totals.coverage !== null && totals.coverage < 0.995;
  const ex = (m: Parameters<typeof explain>[0]) => explain(m, totals);

  return (
    <div className="flex flex-col gap-6">
      {header}

      {partial && totals.coverage !== null && (
        <p role="status" className="flex flex-wrap items-center gap-2 rounded-xl border border-warning/40 bg-warning-bg px-4 py-3 text-sm text-warning">
          فقط {formatNumber(Math.round(totals.coverage * 100))}٪ فروش‌های این بازه قیمت خرید دارند، پس سود واقعی کمتر از این عددهاست.
          <Link href="/finance/products?missing=1" className="font-bold underline underline-offset-4">
            ثبت قیمت خرید محصولات
          </Link>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat
          hero
          index={0}
          label="فروش"
          value={sales.value}
          decimals={sales.decimals}
          unit={sales.unit}
          delta={compare(totals.sales, before.sales, "amount", against)}
          explain={ex("sales")}
          className="col-span-2 lg:col-span-1"
        />
        <Stat
          index={1}
          label={totals.netProfit < 0 ? "زیان خالص" : "سود خالص"}
          value={net.value}
          decimals={net.decimals}
          unit={net.unit}
          delta={compare(totals.netProfit, before.netProfit, "amount", against)}
          explain={ex("netProfit")}
        >
          {partial && totals.coverage !== null && (
            <Badge variant="warning" className="mt-1 w-fit">
              بر اساس {formatNumber(Math.round(totals.coverage * 100))}٪ فروش
            </Badge>
          )}
        </Stat>
        <Stat
          index={2}
          label="حاشیهٔ سود"
          value={pct(totals.margin)}
          style="percent"
          delta={compare(totals.margin, before.margin, "rate", against)}
          explain={ex("margin")}
        />
        <Stat
          index={3}
          label="سفارش‌های پرداخت‌شده"
          value={totals.saleOrders}
          delta={compare(totals.saleOrders, before.saleOrders, "amount", against)}
          explain={ex("saleOrders")}
        />
        <Stat
          index={4}
          label="میانگین هر سفارش"
          value={aov.value}
          decimals={aov.decimals}
          unit={aov.unit}
          delta={compare(totals.averageOrder, before.averageOrder, "amount", against)}
          explain={ex("averageOrder")}
        />
        <Stat
          index={5}
          label="نرخ مرجوعی"
          value={pct(totals.returnRate)}
          style="percent"
          delta={compare(totals.returnRate, before.returnRate, "badRate", against)}
          explain={ex("returnRate")}
        />
      </div>

      {/* Desktop: chart and breakdown on one side, advice beside them. Phone: chart, advice, breakdown. */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>فروش و سود خالص، روزبه‌روز</CardTitle>
            <CardDescription>{range.label}، به تومان</CardDescription>
          </CardHeader>
          <CardContent>
            <FinanceChart points={series} caption={`نمودار فروش و سود خالص روزانه، ${range.label}`} />
          </CardContent>
        </Card>

        <Card className="min-w-0 lg:row-span-2">
          <CardHeader>
            <CardTitle>پیشنهادهای غلتک</CardTitle>
            <CardDescription>از روی عددهای خود فروشگاه؛ پیشنهاد است، نه حکم.</CardDescription>
          </CardHeader>
          <CardContent>
            <InsightList insights={insights} />
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>پول شما از کجا آمد و کجا رفت</CardTitle>
            <CardDescription>{range.label}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ProfitBreakdown totals={totals} />
            {unpaid.orders > 0 && (
              <Link
                href="/orders?status=PENDING_PAYMENT"
                className="rounded-xl border border-line bg-raised-2/50 px-3 py-2.5 text-sm text-ink-soft hover:border-line-strong"
              >
                {formatNumber(unpaid.orders)} سفارش هنوز پرداخت نشده؛ روی هم {formatToman(unpaid.amount)} ←
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
