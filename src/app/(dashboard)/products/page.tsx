import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNumber, formatToman } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireSeller } from "@/server/auth";
import { listCategories, listProducts } from "@/server/catalog/queries";

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
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">محصولات</h1>
        <Link href="/products/new" className={cn(buttonVariants())}>
          محصول جدید
        </Link>
      </div>

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
          className="h-10 rounded-lg border border-neutral-300 bg-transparent px-3 text-sm"
        >
          <option value="">همهٔ دسته‌ها</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline">
          اعمال
        </Button>
        {hasFilters && (
          <Link href="/products" className={cn(buttonVariants({ variant: "ghost" }))}>
            پاک‌کردن فیلترها
          </Link>
        )}
      </form>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-neutral-600">
          {hasFilters ? (
            <p>محصولی با این فیلتر پیدا نشد.</p>
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
          <p className="text-sm text-neutral-500">{formatNumber(total)} محصول</p>
          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-neutral-50 text-start text-neutral-600">
                <tr>
                  <th className="p-3 text-start font-medium">محصول</th>
                  <th className="p-3 text-start font-medium">قیمت</th>
                  <th className="p-3 text-start font-medium">موجودی</th>
                  <th className="p-3 text-start font-medium">وضعیت</th>
                  <th className="p-3">
                    <span className="sr-only">ویرایش</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} className="border-t border-neutral-200">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.imageUrl}
                            alt=""
                            className="size-12 rounded-lg border border-neutral-200 object-cover"
                          />
                        ) : (
                          <div className="size-12 rounded-lg bg-neutral-100" aria-hidden />
                        )}
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-neutral-500">
                            {p.category ?? "بدون دسته‌بندی"} · {formatNumber(p.variantCount)} تنوع
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 whitespace-nowrap">{formatToman(p.price)}</td>
                    <td className="p-3 whitespace-nowrap">{formatNumber(p.totalStock)}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {!p.isActive && <Badge>غیرفعال</Badge>}
                        {p.stockStatus === "OUT_OF_STOCK" && <Badge variant="danger">ناموجود</Badge>}
                        {p.stockStatus === "LOW" && <Badge variant="warning">کم‌موجودی</Badge>}
                        {p.isActive && p.stockStatus === "OK" && <Badge variant="success">فعال</Badge>}
                      </div>
                    </td>
                    <td className="p-3 text-end">
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
              <span className="text-sm text-neutral-600">
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
