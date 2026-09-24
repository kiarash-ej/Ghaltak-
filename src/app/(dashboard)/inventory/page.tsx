import type { Metadata } from "next";
import Link from "next/link";
import { InventoryRow } from "@/components/catalog/inventory-row";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/prisma";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireSeller } from "@/server/auth";
import {
  inventorySummary,
  listInventory,
  type InventoryFilter,
  type InventorySort,
} from "@/server/catalog/inventory-queries";

export const metadata: Metadata = { title: "موجودی | غلتک" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const FILTERS: InventoryFilter[] = ["all", "low", "out"];
const SORTS: { value: InventorySort; label: string }[] = [
  { value: "name", label: "نام محصول" },
  { value: "stock-asc", label: "کمترین موجودی" },
  { value: "stock-desc", label: "بیشترین موجودی" },
];

export default async function InventoryPage(props: PageProps<"/inventory">) {
  const seller = await requireSeller();
  const sp = await props.searchParams;

  const q = first(sp.q)?.trim() ?? "";
  const filterParam = first(sp.filter);
  const filter = FILTERS.includes(filterParam as InventoryFilter)
    ? (filterParam as InventoryFilter)
    : "all";
  const sortParam = first(sp.sort);
  const sort = SORTS.some((s) => s.value === sortParam) ? (sortParam as InventorySort) : "name";
  const requestedPage = Number(first(sp.page)) || 1;

  // Optional "only this product" filter, e.g. linked from the product edit page.
  const productParam = first(sp.product);
  const product = productParam
    ? await prisma.product.findFirst({
        where: { id: productParam, sellerId: seller.id },
        select: { id: true, name: true },
      })
    : null;
  const productId = product?.id;

  const [result, summary] = await Promise.all([
    listInventory(seller.id, { q, filter, sort, productId, page: requestedPage }),
    inventorySummary(seller.id, productId),
  ]);
  const { items, total, page, pageCount } = result;

  const href = (overrides: Record<string, string | number | undefined>) => {
    const values: Record<string, string | number | undefined> = {
      q: q || undefined,
      filter: filter === "all" ? undefined : filter,
      sort: sort === "name" ? undefined : sort,
      product: productId,
      ...overrides,
    };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(values)) {
      if (v !== undefined && v !== "" && !(k === "page" && v === 1)) params.set(k, String(v));
    }
    const qs = params.toString();
    return qs ? `/inventory?${qs}` : "/inventory";
  };

  const tabs: { value: InventoryFilter; label: string; count: number }[] = [
    { value: "all", label: "همه", count: summary.total },
    { value: "low", label: "نیاز به تأمین", count: summary.low },
    { value: "out", label: "ناموجود", count: summary.out },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">موجودی</h1>
        <p className="text-sm text-neutral-600">
          «نیاز به تأمین» یعنی موجودی به آستانهٔ هشدار محصول یا کمتر رسیده است.
        </p>
      </div>

      {product && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-neutral-100 px-3 py-1">فقط محصول: {product.name}</span>
          <Link href="/inventory" className="text-neutral-600 underline">
            نمایش همهٔ محصولات
          </Link>
        </div>
      )}

      <nav className="flex flex-wrap gap-2" aria-label="فیلتر موجودی">
        {tabs.map((t) => (
          <Link
            key={t.value}
            href={href({ filter: t.value === "all" ? undefined : t.value, page: undefined })}
            aria-current={filter === t.value ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm",
              filter === t.value
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-300 hover:bg-neutral-100",
            )}
          >
            {t.label} ({formatNumber(t.count)})
          </Link>
        ))}
      </nav>

      <form method="GET" className="flex flex-wrap items-center gap-2">
        {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
        {productId && <input type="hidden" name="product" value={productId} />}
        <Input
          name="q"
          defaultValue={q}
          placeholder="جستجوی نام محصول یا کد کالا…"
          aria-label="جستجوی نام محصول یا کد کالا"
          className="max-w-xs"
        />
        <select
          name="sort"
          defaultValue={sort}
          aria-label="مرتب‌سازی"
          className="h-10 rounded-lg border border-neutral-300 bg-transparent px-3 text-sm"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline">
          اعمال
        </Button>
      </form>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-neutral-600">
          {summary.total === 0 ? (
            <div className="flex flex-col items-center gap-3">
              <p>هنوز محصولی ثبت نکرده‌اید.</p>
              <Link href="/products/new" className={cn(buttonVariants())}>
                ثبت اولین محصول
              </Link>
            </div>
          ) : filter !== "all" && !q ? (
            <p>موردی در این دسته نیست. همه‌چیز موجود است.</p>
          ) : (
            <p>موردی با این جستجو پیدا نشد.</p>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-neutral-500">{formatNumber(total)} تنوع</p>
          <ul className="flex flex-col gap-3">
            {items.map((row) => (
              <InventoryRow key={row.variantId} row={row} />
            ))}
          </ul>

          {pageCount > 1 && (
            <nav className="flex items-center justify-between" aria-label="صفحه‌بندی">
              {page > 1 ? (
                <Link
                  href={href({ page: page - 1 })}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  صفحهٔ قبل
                </Link>
              ) : (
                <span />
              )}
              <span className="text-sm text-neutral-600">
                صفحهٔ {formatNumber(page)} از {formatNumber(pageCount)}
              </span>
              {page < pageCount ? (
                <Link
                  href={href({ page: page + 1 })}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  صفحهٔ بعد
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
