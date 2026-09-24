import type { Metadata } from "next";
import Link from "next/link";
import type { CustomerTag } from "@/generated/prisma/enums";
import { TagBadge } from "@/components/customers/tag-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, formatNumber, formatToman } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireSeller } from "@/server/auth";
import { countByTag, listCustomers } from "@/server/customers/queries";
import { CUSTOMER_TAGS, TAG_LABELS, isCustomerTag } from "@/server/customers/stats";

export const metadata: Metadata = { title: "مشتریان | غلتک" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CustomersPage(props: PageProps<"/customers">) {
  const seller = await requireSeller();
  const sp = await props.searchParams;
  const q = first(sp.q)?.trim() ?? "";
  const tagParam = first(sp.tag);
  const tag: CustomerTag | undefined = isCustomerTag(tagParam) ? tagParam : undefined;
  const requestedPage = Number(first(sp.page)) || 1;

  const [result, counts] = await Promise.all([
    listCustomers(seller.id, { q, tag, page: requestedPage }),
    countByTag(seller.id),
  ]);
  const { items, total, page, pageCount } = result;

  const href = (overrides: { tag?: CustomerTag | null; page?: number }) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    const t = overrides.tag === undefined ? tag : overrides.tag;
    if (t) params.set("tag", t);
    if (overrides.page && overrides.page > 1) params.set("page", String(overrides.page));
    const qs = params.toString();
    return qs ? `/customers?${qs}` : "/customers";
  };

  const tabs: { value: CustomerTag | null; label: string; count: number }[] = [
    { value: null, label: "همه", count: counts.total },
    ...CUSTOMER_TAGS.map((t) => ({ value: t, label: TAG_LABELS[t], count: counts[t] })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">مشتریان</h1>
        <p className="text-sm text-neutral-600">
          مشتری‌ها هنگام ثبت سفارش (دستی یا از لینک خرید) با شمارهٔ موبایل ساخته می‌شوند.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="فیلتر برچسب">
        {tabs.map((t) => {
          const active = (tag ?? null) === t.value;
          return (
            <Link
              key={t.value ?? "all"}
              href={href({ tag: t.value, page: 1 })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm",
                active ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 hover:bg-neutral-100",
              )}
            >
              {t.label} ({formatNumber(t.count)})
            </Link>
          );
        })}
      </nav>

      <form method="GET" className="flex flex-wrap items-center gap-2">
        {tag && <input type="hidden" name="tag" value={tag} />}
        <Input
          name="q"
          defaultValue={q}
          placeholder="نام یا شمارهٔ موبایل…"
          aria-label="جستجوی نام یا شمارهٔ موبایل"
          className="max-w-xs"
        />
        <Button type="submit" variant="outline">
          جستجو
        </Button>
        {q && (
          <Link href={tag ? `/customers?tag=${tag}` : "/customers"} className={cn(buttonVariants({ variant: "ghost" }))}>
            پاک‌کردن جستجو
          </Link>
        )}
      </form>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-neutral-600">
          {counts.total === 0
            ? "هنوز مشتری‌ای ندارید. با اولین سفارش، مشتری اینجا ظاهر می‌شود."
            : "مشتری‌ای با این مشخصات پیدا نشد."}
        </p>
      ) : (
        <>
          <p className="text-sm text-neutral-500">{formatNumber(total)} مشتری</p>
          <ul className="flex flex-col gap-2">
            {items.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/customers/${c.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-neutral-200 p-3 hover:bg-neutral-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 font-medium">
                      {c.name ?? "بدون نام"}
                      <TagBadge tag={c.tag} />
                    </div>
                    <div className="text-sm text-neutral-600" dir="ltr" style={{ textAlign: "right" }}>
                      {c.phone}
                    </div>
                  </div>
                  <div className="text-sm text-neutral-600">
                    {c.stats.purchaseCount > 0 ? (
                      <>
                        {formatNumber(c.stats.purchaseCount)} خرید · {formatToman(c.stats.totalSpent)}
                        {c.stats.lastPurchaseAt && <> · آخرین خرید {formatDate(c.stats.lastPurchaseAt)}</>}
                      </>
                    ) : c.stats.orderCount > 0 ? (
                      <>{formatNumber(c.stats.orderCount)} سفارش، بدون خرید پرداخت‌شده</>
                    ) : (
                      "بدون سفارش"
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {pageCount > 1 && (
            <nav className="flex items-center justify-between" aria-label="صفحه‌بندی">
              {page > 1 ? (
                <Link href={href({ page: page - 1 })} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  صفحهٔ قبل
                </Link>
              ) : (
                <span />
              )}
              <span className="text-sm text-neutral-600">
                صفحهٔ {formatNumber(page)} از {formatNumber(pageCount)}
              </span>
              {page < pageCount ? (
                <Link href={href({ page: page + 1 })} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
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
