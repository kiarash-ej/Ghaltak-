import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/orders/print-button";
import { formatDateTime, formatNumber, formatToman } from "@/lib/format";
import { requireOwner } from "@/server/auth";
import { parseReportKey } from "@/server/finance/report-periods";
import { getPeriodReport } from "@/server/finance/reports";
import { periodStory } from "@/server/finance/story";
import type { FinanceTotals } from "@/server/finance/summary";
import { getPublicStoreProfile } from "@/server/store/profile";

// The printable period report (spec §6.4): A4 portrait, light paper, no
// dashboard chrome (B9's approach: on paper only the sheet prints). The
// browser's print dialog also saves it as a PDF. A month of a typical store
// fits one page; longer tables continue cleanly on the next. Computed live.

export async function generateMetadata(props: PageProps<"/finance/reports/[key]/print">): Promise<Metadata> {
  const period = parseReportKey((await props.params).key);
  return { title: `گزارش مالی ${period?.label ?? ""} | غلتک` };
}

const pct = (r: number) => `${formatNumber(Math.round(r * 100))}٪`;

type Row = { label: string; now: string; before: string; change: string };

/** "▲ ۱۸٪" for amounts and counts, "▼ ۲ واحد" for rates; "—" without a base. */
function change(now: number | null, before: number | null, kind: "amount" | "rate"): string {
  if (now === null || before === null || (kind === "amount" && before <= 0)) return "—";
  const v = kind === "amount" ? Math.round(((now - before) / Math.abs(before)) * 100) : Math.round((now - before) * 100);
  if (v === 0) return "بدون تغییر";
  return `${v > 0 ? "▲" : "▼"} ${formatNumber(Math.abs(v))}${kind === "amount" ? "٪" : " واحد"}`;
}

function comparison(t: FinanceTotals, b: FinanceTotals): Row[] {
  const money = (label: string, a: number, z: number): Row => ({ label, now: formatToman(a), before: formatToman(z), change: change(a, z, "amount") });
  const rate = (label: string, a: number | null, z: number | null): Row => ({
    label,
    now: a === null ? "—" : pct(a),
    before: z === null ? "—" : pct(z),
    change: change(a, z, "rate"),
  });
  return [
    money("فروش", t.sales, b.sales),
    money("قیمت خرید کالاها", t.cogs, b.cogs),
    money("سود ناخالص", t.grossProfit, b.grossProfit),
    money("هزینه‌ها", t.expenses, b.expenses),
    money("سود خالص", t.netProfit, b.netProfit),
    rate("حاشیهٔ سود", t.margin, b.margin),
    { label: "سفارش‌های پرداخت‌شده", now: formatNumber(t.saleOrders), before: formatNumber(b.saleOrders), change: change(t.saleOrders, b.saleOrders, "amount") },
    { label: "میانگین هر سفارش", now: t.averageOrder === null ? "—" : formatToman(t.averageOrder), before: b.averageOrder === null ? "—" : formatToman(b.averageOrder), change: change(t.averageOrder, b.averageOrder, "amount") },
    rate("نرخ مرجوعی", t.returnRate, b.returnRate),
  ];
}

const th = "border-b border-neutral-400 py-0.5 text-start font-semibold text-neutral-600";
const td = "border-b border-neutral-200 py-[3px]";

export default async function PeriodReportPrintPage(props: PageProps<"/finance/reports/[key]/print">) {
  const owner = await requireOwner();
  const { key } = await props.params;
  const period = parseReportKey(key);
  if (!period || period.to > new Date()) notFound();
  const now = new Date();
  const [report, store] = await Promise.all([getPeriodReport(owner.id, period, now), getPublicStoreProfile(owner.id)]);
  const { current: t, before } = report;
  const story = periodStory(period.label, report.previous.label, t, before);
  const products = report.products.slice(0, 10);

  return (
    <div className="flex flex-col gap-4 print:block">
      {/* Page breaks can be ignored inside flex containers (outside Chrome): block layout on paper. */}
      <style>{"@page { size: A4 portrait; margin: 12mm; } @media print { body { display: block; } }"}</style>

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-col gap-1">
          <Link href={`/finance/reports/${period.key}`} className="text-sm text-muted hover:text-ink hover:underline">
            ← بازگشت به گزارش
          </Link>
          <h1 className="text-2xl font-bold">نسخهٔ چاپی {period.label}</h1>
          <p className="text-sm text-muted">برای PDF، در پنجرهٔ چاپ «ذخیره به‌صورت PDF» را انتخاب کنید.</p>
        </div>
        <PrintButton label="چاپ یا ذخیرهٔ PDF" />
      </div>

      <article
        data-app-theme="light"
        aria-label={`گزارش مالی ${period.label}`}
        className="mx-auto flex w-full max-w-[210mm] flex-col gap-3 rounded-lg border border-neutral-300 bg-white p-[12mm] text-[11px] leading-[18px] text-neutral-900 print:max-w-none print:rounded-none print:border-0 print:p-0"
      >
        <header className="flex items-start justify-between gap-4 border-b-2 border-neutral-900 pb-3">
          <div className="flex min-w-0 items-center gap-3">
            {store?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.logoUrl} alt="" className="size-12 shrink-0 rounded-md object-cover" />
            )}
            <div className="min-w-0">
              <p className="truncate text-base font-black">{store?.name ?? "فروشگاه"}</p>
              <p className="text-neutral-600">گزارش مالی {period.label}</p>
            </div>
          </div>
          <div className="shrink-0 text-end text-neutral-600">
            <p>مقایسه با {report.previous.label}</p>
            <p>تهیه‌شده: {formatDateTime(now)}</p>
          </div>
        </header>

        <section className="break-inside-avoid">
          <p className="text-[13px] leading-6 font-bold">{story.lead.map((p) => (typeof p === "string" ? p : p.strong)).join("")}</p>
          {story.detail && <p className="text-neutral-700">{story.detail}</p>}
        </section>

        <section className="break-inside-avoid">
          <h2 className="mb-0.5 text-[12px] font-black">خلاصه و مقایسه</h2>
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>عنوان</th>
                <th className={th}>{period.label}</th>
                <th className={th}>{report.previous.label}</th>
                <th className={th}>تغییر</th>
              </tr>
            </thead>
            <tbody>
              {comparison(t, before).map((r) => (
                <tr key={r.label} className={r.label === "سود خالص" ? "font-bold" : undefined}>
                  <td className={td}>{r.label}</td>
                  <td className={`${td} tabular-nums`}>{r.now}</td>
                  <td className={`${td} tabular-nums text-neutral-600`}>{r.before}</td>
                  <td className={`${td} tabular-nums`}>{r.change}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="mb-0.5 text-[12px] font-black">محصولات</h2>
          {products.length === 0 ? (
            <p className="text-neutral-600">در این دوره فروشی نبود.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className={th}>محصول</th>
                  <th className={th}>تعداد</th>
                  <th className={th}>فروش</th>
                  <th className={th}>سود ناخالص</th>
                  <th className={th}>حاشیه</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.productId} className="break-inside-avoid">
                    <td className={td}>{p.name}</td>
                    <td className={`${td} tabular-nums`}>{formatNumber(p.units)}</td>
                    <td className={`${td} tabular-nums`}>{formatToman(p.sales)}</td>
                    <td className={`${td} tabular-nums`}>{p.grossProfit === null ? "قیمت خرید ثبت نشده" : formatToman(p.grossProfit)}</td>
                    <td className={`${td} tabular-nums`}>{p.margin === null ? "—" : pct(p.margin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {report.products.length > products.length && (
            <p className="text-neutral-600">و {formatNumber(report.products.length - products.length)} محصول دیگر.</p>
          )}
        </section>

        <section className="break-inside-avoid">
          <h2 className="mb-0.5 text-[12px] font-black">هزینه‌ها به تفکیک</h2>
          {report.expenses.length === 0 ? (
            <p className="text-neutral-600">در این دوره هزینه‌ای ثبت نشده است.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className={th}>نوع</th>
                  <th className={th}>تعداد</th>
                  <th className={th}>مبلغ</th>
                </tr>
              </thead>
              <tbody>
                {report.expenses.map((e) => (
                  <tr key={e.key}>
                    <td className={td}>{e.label}</td>
                    <td className={`${td} tabular-nums`}>{formatNumber(e.count)}</td>
                    <td className={`${td} tabular-nums`}>{formatToman(e.amount)}</td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td className="py-1">جمع</td>
                  <td />
                  <td className="py-1 tabular-nums">{formatToman(t.expenses)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </section>

        <footer className="break-inside-avoid border-t border-neutral-300 pt-2 text-[11px] leading-5 text-neutral-600">
          <p>ارقام به تومان. فروش بدون هزینهٔ ارسال.</p>
          <p>
            فروش: سفارش‌های پرداخت‌شده‌ای که لغو یا مرجوع نشده‌اند، در روز ثبتشان. سود ناخالص: فروش منهای قیمت خرید کالاها. سود خالص: سود ناخالص منهای
            هزینه‌ها. حاشیهٔ سود: سود خالص تقسیم بر فروش.
          </p>
          {t.coverage !== null && t.coverage < 0.995 && <p>فقط {pct(t.coverage)} فروش‌های این دوره قیمت خرید دارند؛ سود واقعی کمتر از این عددهاست.</p>}
        </footer>
      </article>
    </div>
  );
}
