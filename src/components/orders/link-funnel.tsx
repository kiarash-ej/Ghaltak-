import { formatNumber } from "@/lib/format";
import type { FunnelCounts, LinkFunnelRow } from "@/server/reports/link-funnel";

// The purchase-link funnel (B8): views → orders → paid, this month.

const percent = new Intl.NumberFormat("fa-IR", { style: "percent", maximumFractionDigits: 1 });

/** 0.25 -> "۲۵٪"; no rate without views. */
export function formatConversion(rate: number | null): string {
  return rate === null ? "—" : percent.format(rate);
}

export const FUNNEL_NOTE =
  "«بازدید» یعنی مشتری صفحهٔ لینک را باز کرده است؛ پیش‌نمایش پیام‌رسان‌ها، ربات‌ها و دفعاتی که خودتان لینک را باز می‌کنید، شمرده نمی‌شوند. " +
  "«سفارش» همهٔ سفارش‌هایی است که با لینک ثبت شده‌اند و «پرداخت‌شده» همان چیزی است که در گزارش، «فروش» حساب می‌شود. " +
  "«تبدیل» یعنی تعداد پرداخت‌شده‌ها تقسیم بر تعداد بازدیدها.";

/** Four small numbers for one link's card in /orders/links. */
export function LinkFunnelStats({ counts }: { counts: FunnelCounts }) {
  const stats = [
    ["بازدید", formatNumber(counts.views)],
    ["سفارش", formatNumber(counts.orders)],
    ["پرداخت‌شده", formatNumber(counts.paid)],
    ["تبدیل", formatConversion(counts.conversion)],
  ] as const;
  return (
    <dl className="grid grid-cols-4 gap-2 rounded-lg bg-neutral-50 p-2 text-center" aria-label="آمار این ماه">
      {stats.map(([label, value]) => (
        <div key={label} className="flex flex-col-reverse">
          <dt className="text-xs text-neutral-500">{label}</dt>
          <dd className="font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Links with activity this month, plus a total row, for /reports. */
export function LinkFunnelTable({ links, total }: { links: LinkFunnelRow[]; total: FunnelCounts }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm [&_td+td]:ps-3 [&_th+th]:ps-3">
        <thead className="text-neutral-500">
          <tr>
            <th className="py-1 text-start font-medium">لینک</th>
            <th className="py-1 text-start font-medium">بازدید</th>
            <th className="py-1 text-start font-medium">سفارش</th>
            <th className="py-1 text-start font-medium">پرداخت‌شده</th>
            <th className="py-1 text-start font-medium">تبدیل</th>
          </tr>
        </thead>
        <tbody>
          {links.map((l) => (
            <tr key={l.linkId} className="border-t border-neutral-100">
              <td className="py-2">
                {l.title ?? "بدون عنوان"}
                {!l.isActive && <span className="text-xs text-neutral-500"> (غیرفعال)</span>}
              </td>
              <td className="py-2">{formatNumber(l.views)}</td>
              <td className="py-2">{formatNumber(l.orders)}</td>
              <td className="py-2">{formatNumber(l.paid)}</td>
              <td className="py-2">{formatConversion(l.conversion)}</td>
            </tr>
          ))}
        </tbody>
        {links.length > 1 && (
          <tfoot>
            <tr className="border-t border-neutral-300 font-semibold">
              <td className="py-2">جمع کل</td>
              <td className="py-2">{formatNumber(total.views)}</td>
              <td className="py-2">{formatNumber(total.orders)}</td>
              <td className="py-2">{formatNumber(total.paid)}</td>
              <td className="py-2">{formatConversion(total.conversion)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
