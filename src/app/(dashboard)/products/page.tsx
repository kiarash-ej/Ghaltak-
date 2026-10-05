import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNumber, formatToman } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireSeller } from "@/server/auth";
import { listCategories, listProducts } from "@/server/catalog/queries";
import { PageHeader } from "@/components/ui/page-header";
import { CATALOG_TABS } from "@/components/catalog/catalog-tabs";
import { NavTabs } from "@/components/ui/nav-tabs";

export const metadata: Metadata = { title: "محصولات | غلتک" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ProductsPage(props: PageProps<"/products">) {
  const seller = await requireSeller();
  const sp = await props.searchParams;
  const q = first(sp.q)?.trim() ?? "";
  const category = first(sp.category) ?? "";
  const requestedPage = Number(first(sp.page)) || 1;

  const [result, categories] = await Promise.all([
    listProducts(seller.id, { q, category, page: requestedPage }),
    listCategories(seller.id),
  ]);
  const { items, total, page, pageCount } = result;
  const hasFilters = q !== "" || category !== "";

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/products?${qs}` : "/products";
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="محصولات و موجودی"
        description="محصول‌ها با قیمت و تنوع رنگ و سایز، و موجودی هر تنوع."
        actions={
          <Link href="/products/new" className={cn(buttonVariants())}>
            محصول جدید
          </Link>
        }
      />
      <NavTabs label="محصولات یا موجودی" tabs={CATALOG_TABS} />

      <form method="GET" className="flex flex-wrap items-center gap-2">
        <Input
          name="q"
          defaultValue={q}
          placeholder="جستجوی نام محصول…"
          aria-label="جستجوی نام محصول"
          className="max-w-xs"
        />
        <select
          name="category"
          defaultValue={category}
          aria-label="فیلتر دسته‌بندی"
          className="h-10 rounded-lg border border-line-strong bg-transparent px-3 text-sm"
        >
          <option value="">همهٔ دسته‌ها</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline">
          اعمال فیلتر
        </Button>
        {hasFilters && (
          <Link href="/products" className={cn(buttonVariants({ variant: "ghost" }))}>
            پاک‌کردن فیلترها
          </Link>
        )}
      </form>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong p-10 text-center text-muted">
          {hasFilters ? (
            <p>محصولی با این فیلترها پیدا نشد.</p>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <p>هنوز محصولی ثبت نکرده‌اید.</p>
              <Link href="/products/new" className={cn(buttonVariants())}>
                ثبت اولین محصول
              </Link>
            </div>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-muted">{formatNumber(total)} محصول</p>
          {/* One table; on phones each row is restyled as a card (see orders/page.tsx). */}
          <div className="relative overflow-x-auto md:rounded-xl md:border md:border-line">
            <table role="table" className="w-full text-sm md:min-w-[40rem]">
              <thead role="rowgroup" className="bg-raised-2 text-start text-muted max-md:hidden">
                <tr role="row">
                  <th role="columnheader" className="p-3 text-start font-medium">محصول</th>
                  <th role="columnheader" className="p-3 text-start font-medium">قیمت</th>
                  <th role="columnheader" className="p-3 text-start font-medium">موجودی</th>
                  <th role="columnheader" className="p-3 text-start font-medium">وضعیت</th>
                  <th role="columnheader" className="p-3">
                    <span className="sr-only">ویرایش</span>
                  </th>
                </tr>
              </thead>
              <tbody role="rowgroup" className="max-md:flex max-md:flex-col max-md:gap-2.5">
                {items.map((p, i) => (
                  <tr
                    key={p.id}
                    role="row"
                    style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
                    className="animate-rise border-t border-line transition-colors md:hover:bg-raised-2/50 max-md:grid max-md:grid-cols-[1fr_auto] max-md:items-center max-md:gap-x-3 max-md:gap-y-2 max-md:rounded-2xl max-md:border max-md:bg-raised max-md:p-3.5"
                  >
                    <td role="cell" className="p-3 max-md:col-start-1 max-md:row-start-1 max-md:p-0">
                      <div className="flex items-center gap-3">
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.imageUrl}
                            alt=""
                            className="size-12 rounded-lg border border-line object-cover"
                          />
                        ) : (
                          <div className="size-12 rounded-lg bg-raised-2" aria-hidden />
                        )}
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted">
                            {p.category ?? "بدون دسته‌بندی"} · {formatNumber(p.variantCount)} تنوع
                          </div>
                        </div>
                      </div>
                    </td>
                    <td role="cell" className="p-3 font-semibold whitespace-nowrap tabular-nums max-md:col-start-1 max-md:row-start-2 max-md:p-0">
                      {formatToman(p.price)}
                    </td>
                    <td role="cell" className="p-3 whitespace-nowrap tabular-nums max-md:col-start-2 max-md:row-start-2 max-md:p-0 max-md:text-xs max-md:text-muted">
                      <span className="md:hidden">موجودی </span>
                      {formatNumber(p.totalStock)}
                    </td>
                    <td role="cell" className="p-3 max-md:col-start-2 max-md:row-start-1 max-md:p-0">
                      <div className="flex flex-wrap gap-1 max-md:justify-end">
                        {!p.isActive && <Badge>غیرفعال</Badge>}
                        {p.stockStatus === "OUT_OF_STOCK" && <Badge variant="danger">ناموجود</Badge>}
                        {p.stockStatus === "LOW" && <Badge variant="warning">کم‌موجودی</Badge>}
                        {p.isActive && p.stockStatus === "OK" && <Badge variant="success">فعال</Badge>}
                      </div>
                    </td>
                    <td role="cell" className="p-3 text-end max-md:col-span-2 max-md:row-start-3 max-md:p-0">
                      <Link
                        href={`/products/${p.id}/edit`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                      >
                        ویرایش
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <nav className="flex items-center justify-between" aria-label="صفحه‌بندی">
              {page > 1 ? (
                <Link href={pageHref(page - 1)} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  صفحهٔ قبل
                </Link>
              ) : (
                <span />
              )}
              <span className="text-sm text-muted">
                صفحهٔ {formatNumber(page)} از {formatNumber(pageCount)}
              </span>
              {page < pageCount ? (
                <Link href={pageHref(page + 1)} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
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
