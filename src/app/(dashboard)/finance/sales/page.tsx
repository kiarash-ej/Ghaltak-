import type { Metadata } from "next";
import Link from "next/link";
import { BarList } from "@/components/finance/bar-list";
import { FinanceHeader } from "@/components/finance/finance-header";
import { SalesTrend } from "@/components/finance/sales-trend";
import { FUNNEL_NOTE, LinkFunnelTable } from "@/components/orders/link-funnel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { formatNumber, formatToman } from "@/lib/format";
import { requireMember } from "@/server/auth";
import { compactToman } from "@/server/dashboard/brief-text";
import { getDailySales, getSalesBreakdown } from "@/server/finance/breakdowns";
import { compare } from "@/server/finance/glossary";
import { resolveFinanceRange } from "@/server/finance/periods";
import { getFinanceTotals } from "@/server/finance/summary";
import { PAYMENT_METHOD_LABELS } from "@/server/orders/payment";
import { getLinkFunnel } from "@/server/reports/link-funnel";

// «فروش» (spec §6.4): the sales trend, weekdays, payment methods, links vs
// manual orders, the link funnel, best customers and products, for the
// chosen period. The owner sees money; an operator sees counts only, and
// only counts are passed to client components on their page (A10).

export const metadata: Metadata = { title: "فروش | مالی و گزارش | غلتک" };

const WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
const SOURCE_LABELS = { MANUAL: "سفارش دستی", PURCHASE_LINK: "لینک خرید" } as const;
const DEFINITION =
  "فروش یعنی سفارش‌های پرداخت‌شده (پرداخت‌شده، در حال آماده‌سازی، ارسال‌شده و تحویل‌شده)، هر کدام در روز ثبتش به وقت ایران. سفارش‌های لغوشده، مرجوعی و در انتظار پرداخت حساب نمی‌شوند.";

export default async function SalesPage(props: PageProps<"/finance/sales">) {
  const member = await requireMember();
  const now = new Date();
  const { range, error } = resolveFinanceRange(await props.searchParams, now);
  const isOwner = member.role === "OWNER";
  const against = range.compareLabel;

  const [totals, before, breakdown, funnel] = await Promise.all([
    getFinanceTotals(member.id, range.from, range.to),
    getFinanceTotals(member.id, range.previous.from, range.previous.to),
    getSalesBreakdown(member.id, range.from, range.to, isOwner ? "sales" : "units"),
    getLinkFunnel(member.id, now, range),
  ]);
  const activeLinks = funnel.links.filter((l) => l.views > 0 || l.orders > 0);
  const header = <FinanceHeader basePath="/finance/sales" range={range} error={error} isOwner={isOwner} />;

  const productsCard = (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>پرفروش‌ترین محصولات</CardTitle>
        <CardDescription>{range.label}</CardDescription>
      </CardHeader>
      <CardContent>
        {breakdown.topProducts.length === 0 ? (
          <p className="text-sm text-muted">در این بازه فروشی نبوده است.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-1.5 text-start font-medium">محصول</th>
                <th className="py-1.5 text-start font-medium">تعداد</th>
                {isOwner && <th className="py-1.5 text-end font-medium">فروش</th>}
              </tr>
            </thead>
            <tbody>
              {breakdown.topProducts.map((p) => (
                <tr key={p.productId} className="border-t border-line">
                  <td className="py-2.5 font-semibold">{p.name}</td>
                  <td className="py-2.5 tabular-nums">{formatNumber(p.units)}</td>
                  {isOwner && <td className="py-2.5 text-end whitespace-nowrap tabular-nums">{formatToman(p.sales)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );

  const funnelCard = (
    <Card>
      <CardHeader>
        <CardTitle>قیف لینک‌های خرید</CardTitle>
        <CardDescription>بازدید، سفارش و پرداخت هر لینک خرید، {range.label}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {activeLinks.length === 0 ? (
          <p className="text-sm text-muted">در این بازه کسی لینک‌های خرید شما را باز نکرده است.</p>
        ) : (
          <LinkFunnelTable links={activeLinks} total={funnel.total} />
        )}
        <Link href="/orders/links" className="w-fit text-sm text-muted hover:underline">
          مدیریت لینک‌های خرید ←
        </Link>
      </CardContent>
    </Card>
  );

  if (!isOwner) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Stat index={0} label="سفارش‌های ثبت‌شده" value={totals.ordersPlaced} delta={compare(totals.ordersPlaced, before.ordersPlaced, "amount", against)} />
          <Stat index={1} label="سفارش‌های پرداخت‌شده" value={totals.saleOrders} delta={compare(totals.saleOrders, before.saleOrders, "amount", against)} />
          <Stat index={2} label="کالای فروخته‌شده" value={breakdown.units} className="col-span-2 lg:col-span-1" />
        </div>
        {productsCard}
        {funnelCard}
        <p className="text-xs leading-6 text-muted">
          {DEFINITION} {FUNNEL_NOTE}
        </p>
      </div>
    );
  }

  const days = await getDailySales(member.id, range.from, range.to);
  const sales = compactToman(totals.sales);
  const aov = compactToman(totals.averageOrder ?? 0);
  const amount = (v: number) => {
    const c = compactToman(v);
    return `${formatNumber(c.value)} ${c.unit}`;
  };
  const orders = (n: number) => `${formatNumber(n)} سفارش`;

  return (
    <div className="flex flex-col gap-6">
      {header}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          hero
          index={0}
          label="فروش"
          value={sales.value}
          decimals={sales.decimals}
          unit={sales.unit}
          delta={compare(totals.sales, before.sales, "amount", against)}
          className="col-span-2 lg:col-span-1"
        />
        <Stat index={1} label="سفارش‌های پرداخت‌شده" value={totals.saleOrders} delta={compare(totals.saleOrders, before.saleOrders, "amount", against)} />
        <Stat index={2} label="کالای فروخته‌شده" value={breakdown.units} />
        <Stat
          index={3}
          label="میانگین هر سفارش"
          value={aov.value}
          decimals={aov.decimals}
          unit={aov.unit}
          delta={compare(totals.averageOrder, before.averageOrder, "amount", against)}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>روند فروش</CardTitle>
          <CardDescription>{range.label}، به تومان؛ پرفروش‌ترین ستون به رنگ آتش</CardDescription>
        </CardHeader>
        <CardContent>
          <SalesTrend days={days} from={range.from} to={range.to} caption={`فروش ${range.label}`} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {productsCard}
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>بهترین مشتری‌ها</CardTitle>
            <CardDescription>بیشترین خرید در {range.label}</CardDescription>
          </CardHeader>
          <CardContent>
            {breakdown.topCustomers.length === 0 ? (
              <p className="text-sm text-muted">در این بازه خریدی نبوده است.</p>
            ) : (
              <ol className="flex flex-col divide-y divide-line text-sm">
                {breakdown.topCustomers.map((c, i) => (
                  <li key={c.customerId}>
                    <Link href={`/customers/${c.customerId}`} className="flex items-center gap-3 py-2.5 hover:underline">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-raised-2 text-xs font-bold text-ink-soft">{formatNumber(i + 1)}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold">{c.name || <span dir="ltr">{c.phone}</span>}</span>
                      <span className="text-xs text-muted">{orders(c.orders)}</span>
                      <span className="whitespace-nowrap font-bold tabular-nums">{formatToman(c.sales)}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>روزهای هفته</CardTitle>
            <CardDescription>کدام روزها بیشتر می‌فروشید</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList
              empty="در این بازه فروشی نبوده است."
              items={breakdown.byWeekday.map((d, i) => ({ key: WEEKDAYS[i], label: WEEKDAYS[i], value: d.sales, display: amount(d.sales), sub: orders(d.orders) }))}
            />
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>روش پرداخت</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList
              empty="در این بازه پرداختی نبوده است."
              items={breakdown.payment.map((p) => ({
                key: p.key ?? "none",
                label: p.key ? PAYMENT_METHOD_LABELS[p.key] : "نامشخص",
                value: p.sales,
                display: amount(p.sales),
                sub: orders(p.orders),
              }))}
            />
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>لینک خرید یا سفارش دستی</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList
              empty="در این بازه فروشی نبوده است."
              items={breakdown.source.map((s) => ({ key: s.key, label: SOURCE_LABELS[s.key], value: s.sales, display: amount(s.sales), sub: orders(s.orders) }))}
            />
          </CardContent>
        </Card>
      </div>

      {funnelCard}

      <p className="text-xs leading-6 text-muted">
        {DEFINITION} مبلغ‌ها بدون هزینهٔ ارسال‌اند. {FUNNEL_NOTE}
      </p>
    </div>
  );
}
