import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_TIME_ZONE, formatDate, formatNumber, formatToman } from "@/lib/format";
import { requireSeller } from "@/server/auth";
import { STATUS_LABELS } from "@/server/orders/status";
import { CHART_DAYS, getSalesReport, type SalesSummary } from "@/server/reports/queries";
import { SalesChart } from "./sales-chart";

export const metadata: Metadata = { title: "گزارش فروش | غلتک" };

const dayLabel = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: APP_TIME_ZONE,
  day: "numeric",
  month: "long",
});

function StatTile({ label, summary }: { label: string; summary: SalesSummary }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 pt-6">
        <div className="text-sm text-neutral-500">{label}</div>
        <div className="text-2xl font-semibold">{formatToman(summary.total)}</div>
        <div className="text-sm text-neutral-600">
          {formatNumber(summary.count)} سفارش
          {summary.count > 0 && <> · میانگین {formatToman(summary.average)}</>}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function ReportsPage() {
  const seller = await requireSeller();
  const report = await getSalesReport(seller.id);
  const buyers = report.customers.newCustomers + report.customers.returningCustomers;
  const days = report.daily.map((d) => ({
    key: d.key,
    // Noon of the day, so the label is that Tehran day whatever the offset.
    label: dayLabel.format(new Date(d.start.getTime() + 12 * 60 * 60 * 1000)),
    total: d.total,
    count: d.count,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">گزارش فروش</h1>
        <p className="text-sm text-neutral-500">امروز {formatDate(new Date())}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="فروش امروز" summary={report.today} />
        <StatTile label="فروش این هفته" summary={report.week} />
        <StatTile label="فروش این ماه" summary={report.month} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>فروش روزانه</CardTitle>
          <CardDescription>{formatNumber(CHART_DAYS)} روز گذشته، به تومان</CardDescription>
        </CardHeader>
        <CardContent>
          <SalesChart days={days} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>پرفروش‌ترین محصولات این ماه</CardTitle>
          </CardHeader>
          <CardContent>
            {report.topProducts.length === 0 ? (
              <p className="text-sm text-neutral-500">این ماه هنوز فروشی نداشته‌اید.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-neutral-500">
                  <tr>
                    <th className="py-1 text-start font-medium">محصول</th>
                    <th className="py-1 text-start font-medium">تعداد</th>
                    <th className="py-1 text-start font-medium">فروش</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topProducts.map((p) => (
                    <tr key={p.productId} className="border-t border-neutral-100">
                      <td className="py-2">{p.name}</td>
                      <td className="py-2">{formatNumber(p.quantity)}</td>
                      <td className="py-2 whitespace-nowrap">{formatToman(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>مشتریان این ماه</CardTitle>
            <CardDescription>کسانی که این ماه خرید کرده‌اند</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex gap-8">
              <div>
                <div className="text-2xl font-semibold">{formatNumber(report.customers.newCustomers)}</div>
                <div className="text-sm text-neutral-600">مشتری جدید</div>
              </div>
              <div>
                <div className="text-2xl font-semibold">
                  {formatNumber(report.customers.returningCustomers)}
                </div>
                <div className="text-sm text-neutral-600">مشتری بازگشتی</div>
              </div>
            </div>
            {buyers > 0 && (
              <div
                className="flex h-2 gap-0.5 overflow-hidden rounded-full"
                role="img"
                aria-label={`${formatNumber(report.customers.newCustomers)} جدید، ${formatNumber(report.customers.returningCustomers)} بازگشتی`}
              >
                <div className="bg-[#2a78d6]" style={{ flexGrow: report.customers.newCustomers }} />
                <div className="bg-[#86b6ef]" style={{ flexGrow: report.customers.returningCustomers }} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>سفارش‌های در جریان</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-neutral-100 text-sm">
              {report.openOrders.map((o) => (
                <li key={o.status}>
                  <Link
                    href={`/orders?status=${o.status}`}
                    className="flex items-center justify-between py-2 hover:underline"
                  >
                    <span>{STATUS_LABELS[o.status]}</span>
                    <span className="font-semibold">{formatNumber(o.count)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>کم‌موجودی</CardTitle>
            <CardDescription>
              {formatNumber(report.lowStock.total)} تنوع به آستانهٔ کم‌موجودی رسیده است
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {report.lowStock.rows.length === 0 ? (
              <p className="text-sm text-neutral-500">همهٔ کالاها موجودی کافی دارند.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-neutral-100 text-sm">
                {report.lowStock.rows.map((v) => (
                  <li key={v.variantId} className="flex items-center justify-between gap-3 py-2">
                    <span>
                      {v.productName}
                      {(v.color || v.size) && (
                        <span className="text-neutral-500"> · {[v.color, v.size].filter(Boolean).join(" / ")}</span>
                      )}
                    </span>
                    <span className={v.stock <= 0 ? "font-semibold text-red-700" : "font-semibold"}>
                      {v.stock <= 0 ? "ناموجود" : formatNumber(v.stock)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/inventory?filter=low" className="text-sm text-neutral-600 hover:underline">
              مشاهده در صفحهٔ موجودی ←
            </Link>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-neutral-500">
        فروش یعنی سفارش‌های پرداخت‌شده (پرداخت‌شده، در حال آماده‌سازی، ارسال‌شده و تحویل‌شده) بر اساس روز ثبت
        سفارش به وقت ایران. سفارش‌های لغوشده، مرجوعی و در انتظار پرداخت حساب نمی‌شوند. مبالغ بدون هزینهٔ ارسال
        است.
      </p>
    </div>
  );
}
