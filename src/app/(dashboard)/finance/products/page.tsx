import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { CostField } from "@/components/finance/cost-field";
import { FinanceHeader } from "@/components/finance/finance-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatToman } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireOwner } from "@/server/auth";
import { getProductProfit, type ProductProfitRow } from "@/server/finance/breakdowns";
import { setProductCostAction } from "@/server/finance/cost-actions";
import { resolveFinanceRange } from "@/server/finance/periods";

// «سود محصولات» (spec §6.4): every product sold in the period with its units,
// sales, cost of goods, gross profit and margin, sortable. Where a cost price
// is missing, the field to add it is right on the row. The owner's only (a
// 404 for operators).

export const metadata: Metadata = { title: "سود محصولات | مالی و گزارش | غلتک" };

const SORTS = {
  sales: { label: "فروش", by: (r: ProductProfitRow) => r.sales },
  profit: { label: "سود ناخالص", by: (r: ProductProfitRow) => r.grossProfit },
  margin: { label: "حاشیه", by: (r: ProductProfitRow) => r.margin },
  units: { label: "تعداد", by: (r: ProductProfitRow) => r.units },
} as const;
type SortKey = keyof typeof SORTS;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const pct = (r: number) => `${formatNumber(Math.round(r * 100))}٪`;

function marginTone(margin: number) {
  if (margin < 0) return "danger";
  if (margin < 0.15) return "warning";
  return "success";
}

export default async function ProductProfitPage(props: PageProps<"/finance/products">) {
  const owner = await requireOwner();
  const params = await props.searchParams;
  const { range, error } = resolveFinanceRange(params, new Date());
  const asked = one(params.sort);
  const sort: SortKey = asked && asked in SORTS ? (asked as SortKey) : "sales";
  const missingOnly = one(params.missing) === "1";

  const all = await getProductProfit(owner.id, range.from, range.to);
  const missingCount = all.filter((r) => r.uncostedUnits > 0).length;
  // Largest first; rows without a profit (no cost yet) at the end.
  const rows = [...(missingOnly ? all.filter((r) => r.uncostedUnits > 0) : all)].sort((a, b) => {
    const x = SORTS[sort].by(a);
    const y = SORTS[sort].by(b);
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
    return y - x || b.sales - a.sales;
  });

  // Links that keep the period and change only the sort or the filter.
  const href = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams();
    for (const key of ["period", "from", "to", "sort", "missing"]) {
      const value = key in patch ? patch[key] : one(params[key]);
      if (value) q.set(key, value);
    }
    const s = q.toString();
    return s ? `/finance/products?${s}` : "/finance/products";
  };

  return (
    <div className="flex flex-col gap-6">
      <FinanceHeader isOwner period={{ basePath: "/finance/products", range, error }} />

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>سود هر محصول</CardTitle>
          <CardDescription>
            {range.label}. سود ناخالص یعنی فروش منهای قیمت خرید، پیش از هزینه‌هایی مثل تبلیغ و ارسال؛ حاشیه یعنی چند درصدِ فروش، سود است.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">مرتب‌سازی:</span>
            {(Object.keys(SORTS) as SortKey[]).map((key) => (
              <Link
                key={key}
                href={href({ sort: key === "sales" ? null : key })}
                aria-current={sort === key ? "true" : undefined}
                className={cn(
                  "rounded-full border px-3 py-1 font-semibold transition-colors",
                  sort === key ? "border-transparent bg-raised-2 text-ink" : "border-line text-ink-soft hover:text-ink",
                )}
              >
                {SORTS[key].label}
              </Link>
            ))}
            {missingCount > 0 && (
              <Link
                href={href({ missing: missingOnly ? null : "1" })}
                aria-current={missingOnly ? "true" : undefined}
                className={cn(
                  "ms-auto rounded-full border px-3 py-1 font-semibold transition-colors",
                  missingOnly ? "border-transparent bg-warning-bg text-warning" : "border-warning/40 text-warning hover:bg-warning-bg",
                )}
              >
                {missingOnly ? "نمایش همه" : `فقط بدون قیمت خرید (${formatNumber(missingCount)})`}
              </Link>
            )}
          </div>

          {rows.length === 0 ? (
            <p className="text-sm text-muted">
              {missingOnly ? "همهٔ محصولات فروخته‌شدهٔ این بازه قیمت خرید دارند. 🎉" : "در این بازه فروشی نبوده است."}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {/* A table on wide screens (header row), a card per product on phones. */}
              <li aria-hidden className="hidden grid-cols-[2fr_repeat(5,1fr)] gap-3 pb-2 text-xs font-medium text-muted md:grid">
                <span>محصول</span>
                <span>تعداد</span>
                <span>فروش</span>
                <span>قیمت خرید کالاها</span>
                <span>سود ناخالص</span>
                <span>حاشیه</span>
              </li>
              {rows.map((r) => (
                <li key={r.productId} data-product={r.name} className="flex flex-col gap-3 py-3.5">
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm md:grid-cols-[2fr_repeat(5,1fr)] md:items-center">
                    <div className="col-span-2 md:col-span-1">
                      <dt className="sr-only">محصول</dt>
                      <dd>
                        <Link href={`/products/${r.productId}/edit`} className="font-bold hover:underline">
                          {r.name}
                        </Link>
                      </dd>
                    </div>
                    <Cell label="تعداد">{formatNumber(r.units)}</Cell>
                    <Cell label="فروش">{formatToman(r.sales)}</Cell>
                    <Cell label="قیمت خرید کالاها">{r.grossProfit === null ? "—" : formatToman(r.cogs)}</Cell>
                    <Cell label="سود ناخالص">
                      {r.grossProfit === null ? "—" : <span className={r.grossProfit < 0 ? "text-danger" : undefined}>{formatToman(r.grossProfit)}</span>}
                    </Cell>
                    <Cell label="حاشیه">
                      {r.margin === null ? (
                        <Badge variant="warning">قیمت خرید ثبت نشده</Badge>
                      ) : (
                        <Badge variant={marginTone(r.margin)}>{pct(r.margin)}</Badge>
                      )}
                    </Cell>
                  </dl>
                  {r.uncostedUnits > 0 && (
                    <div className="flex flex-col gap-2 rounded-xl border border-warning/30 bg-warning-bg/40 p-3">
                      <p className="text-sm text-warning">
                        {r.grossProfit === null
                          ? "قیمت خرید این محصول ثبت نشده، پس سودش معلوم نیست."
                          : `${formatNumber(r.uncostedUnits)} عدد از فروش‌های این بازه قیمت خرید ندارند؛ سود و حاشیه فقط از بقیه حساب شده است.`}
                      </p>
                      <CostField action={setProductCostAction.bind(null, r.productId)} productName={r.name} initial={r.costPrice} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted md:sr-only">{label}</dt>
      <dd className="whitespace-nowrap tabular-nums">{children}</dd>
    </div>
  );
}
