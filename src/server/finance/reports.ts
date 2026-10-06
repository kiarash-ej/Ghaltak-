import "server-only";
import { prisma } from "@/lib/prisma";
import { getProductProfit, type ProductProfitRow } from "./breakdowns";
import { CATEGORY_LABELS, EXPENSE_CATEGORIES } from "./expense-categories";
import { listExpenses } from "./expenses";
import { advise, type Insight } from "./insights";
import { loadInsightFacts } from "./insights/facts";
import { jalaliOfInstant } from "./periods";
import { monthKey } from "./months";
import { finishedPeriods, previousPeriod, reportRange, type ReportKind, type ReportPeriod } from "./report-periods";
import { getFinanceSeries, getFinanceTotals, type FinanceTotals } from "./summary";

// Period reports (spec §6.4) and the numbers behind Home's recap (§7.2).
// Computed live, so late returns and corrected costs show up. Owner only.

export type ArchiveRow = ReportPeriod & { sales: number; net: number };

/** Every finished month, season and year since the store's first order, with sales and net profit. */
export async function getReportArchive(sellerId: string, now = new Date()): Promise<Record<ReportKind, ArchiveRow[]>> {
  const first = await prisma.order.findFirst({ where: { sellerId }, orderBy: { createdAt: "asc" }, select: { createdAt: true } });
  const periods = first ? finishedPeriods(first.createdAt, now) : { month: [], season: [], year: [] };
  if (periods.month.length === 0) return { month: [], season: [], year: [] };

  // One daily series over the whole span, summed per Jalali month; seasons and years add up their months.
  const oldest = periods.month[periods.month.length - 1];
  const series = await getFinanceSeries(sellerId, oldest.from, periods.month[0].to);
  const byMonth = new Map<string, { sales: number; net: number }>();
  for (const day of series) {
    const key = monthKey(jalaliOfInstant(new Date(`${day.key}T08:30:00Z`)));
    const sum = byMonth.get(key) ?? { sales: 0, net: 0 };
    byMonth.set(key, { sales: sum.sales + day.sales, net: sum.net + day.net });
  }
  const add = (p: ReportPeriod): ArchiveRow => {
    let sales = 0;
    let net = 0;
    for (const [key, sum] of byMonth) {
      const inside = p.kind === "month" ? key === p.key : p.kind === "year" ? key.startsWith(`${p.key}-`) : seasonOfKey(key) === p.key;
      if (inside) {
        sales += sum.sales;
        net += sum.net;
      }
    }
    return { ...p, sales, net };
  };
  return { month: periods.month.map(add), season: periods.season.map(add), year: periods.year.map(add) };
}

const seasonOfKey = (month: string) => `${month.slice(0, 4)}-s${Math.ceil(Number(month.slice(5)) / 3)}`;

// The advice that is about the period itself, not about today (stock, open
// orders, this month's links). The facts for those aren't even loaded for a
// report (scope "period"); the filter keeps any future rule of that kind out.
const PERIOD_ADVICE = new Set(["sales-trend", "growth-driver", "thin-margin", "missing-costs", "returns-jump", "smaller-orders", "costs-outpacing", "repeat-customers"]);

export type PeriodReport = {
  period: ReportPeriod;
  previous: ReportPeriod;
  current: FinanceTotals;
  before: FinanceTotals;
  products: ProductProfitRow[];
  expenses: { key: string; label: string; amount: number; count: number }[];
  insights: Insight[];
};

export async function getPeriodReport(sellerId: string, period: ReportPeriod, now = new Date()): Promise<PeriodReport> {
  const previous = previousPeriod(period);
  const range = reportRange(period);
  const [current, before, products, expenseRows] = await Promise.all([
    getFinanceTotals(sellerId, period.from, period.to),
    getFinanceTotals(sellerId, previous.from, previous.to),
    getProductProfit(sellerId, period.from, period.to),
    listExpenses(sellerId, period.from, period.to),
  ]);
  const facts = await loadInsightFacts(sellerId, range, { current, previous: before }, now, "period");
  const expenses = EXPENSE_CATEGORIES.map((c) => {
    const rows = expenseRows.filter((e) => e.category === c);
    return { key: c, label: CATEGORY_LABELS[c], amount: rows.reduce((s, e) => s + e.amount, 0), count: rows.length };
  })
    .filter((e) => e.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  return { period, previous, current, before, products, expenses, insights: advise(facts).filter((i) => PERIOD_ADVICE.has(i.id)) };
}

/** What Home's recap card shows; null outside a new period's first week or when the period had no sales. */
export async function getRecap(sellerId: string, recap: { period: ReportPeriod; alsoEnded: ReportPeriod[] }) {
  const previous = previousPeriod(recap.period);
  const [current, before, products] = await Promise.all([
    getFinanceTotals(sellerId, recap.period.from, recap.period.to),
    getFinanceTotals(sellerId, previous.from, previous.to),
    getProductProfit(sellerId, recap.period.from, recap.period.to),
  ]);
  if (current.saleOrders === 0) return null;
  return { ...recap, previous, current, before, bestProduct: products[0]?.name ?? null };
}
