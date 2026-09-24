import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StockBadge } from "@/components/catalog/inventory-row";
import { buttonVariants } from "@/components/ui/button";
import { formatDateTime, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireSeller } from "@/server/auth";
import { HISTORY_LIMIT, getVariantHistory } from "@/server/catalog/inventory-queries";
import { STOCK_REASON_LABELS, variantLabel } from "@/server/catalog/labels";
import { getVariantStockStatus } from "@/server/catalog/stock-status";

export const metadata: Metadata = { title: "تاریخچهٔ موجودی | غلتک" };

export default async function VariantHistoryPage(props: PageProps<"/inventory/[variantId]">) {
  const seller = await requireSeller();
  const { variantId } = await props.params;

  // Scoped by sellerId: another seller's variant id behaves like a missing one.
  const history = await getVariantHistory(seller.id, variantId);
  if (!history) notFound();
  const { variant, movements, totalMovements } = history;
  const status = getVariantStockStatus(variant.stock, variant.product.lowStockThreshold);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">تاریخچهٔ موجودی</h1>
        <div className="flex gap-2">
          <Link
            href={`/inventory?product=${variant.product.id}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            بازگشت به موجودی
          </Link>
          <Link
            href={`/products/${variant.product.id}/edit`}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            ویرایش محصول
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-neutral-200 p-4">
        {variant.product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={variant.product.imageUrl}
            alt=""
            className="size-16 rounded-lg border border-neutral-200 object-cover"
          />
        ) : (
          <div className="size-16 rounded-lg bg-neutral-100" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold">{variant.product.name}</div>
          <div className="text-sm text-neutral-600">
            {variantLabel(variant)}
            {variant.sku && (
              <>
                {" · "}
                <span dir="ltr">{variant.sku}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-center">
            <div className="text-3xl font-bold leading-none">{formatNumber(variant.stock)}</div>
            <div className="mt-1 text-xs text-neutral-500">موجودی فعلی</div>
          </div>
          <StockBadge status={status} />
        </div>
      </div>

      {movements.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-neutral-600">
          هنوز تغییری در موجودی این تنوع ثبت نشده است.
        </p>
      ) : (
        <>
          {totalMovements > movements.length && (
            <p className="text-sm text-neutral-500">
              {formatNumber(HISTORY_LIMIT)} تغییر آخر از {formatNumber(totalMovements)} تغییر نمایش داده می‌شود.
            </p>
          )}
          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full min-w-[32rem] text-sm">
              <thead className="bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="p-3 text-start font-medium">زمان</th>
                  <th className="p-3 text-start font-medium">تغییر</th>
                  <th className="p-3 text-start font-medium">علت</th>
                  <th className="p-3 text-start font-medium">توضیح</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-t border-neutral-200">
                    <td className="p-3 whitespace-nowrap">{formatDateTime(m.createdAt)}</td>
                    <td className="p-3 whitespace-nowrap">
                      <span
                        dir="ltr"
                        className={cn("font-medium", m.delta > 0 ? "text-green-700" : "text-red-700")}
                      >
                        {m.delta > 0 ? "+" : "−"}
                        {formatNumber(Math.abs(m.delta))}
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap">{STOCK_REASON_LABELS[m.reason]}</td>
                    <td className="p-3 text-neutral-600">{m.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
