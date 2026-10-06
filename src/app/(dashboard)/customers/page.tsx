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
import { PageHeader } from "@/components/ui/page-header";

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
      <PageHeader
        title="مشتریان"
        description="با ثبت هر سفارش (دستی یا با لینک خرید)، مشتری با شمارهٔ موبایلش به این فهرست اضافه می‌شود."
      />

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
                active ? "border-transparent bg-action" : "border-line-strong hover:bg-raised-2",
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
        <p className="rounded-xl border border-dashed border-line-strong p-10 text-center text-muted">
          {counts.total === 0
            ? "هنوز مشتری‌ای ندارید. با ثبت اولین سفارش، مشتری‌هایتان اینجا اضافه می‌شوند."
            : "مشتری‌ای با این مشخصات پیدا نشد."}
        </p>
      ) : (
        <>
          <p className="text-sm text-muted">{formatNumber(total)} مشتری</p>
          <ul className="flex flex-col gap-2.5">
            {items.map((c, i) => (
              <li key={c.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                <Link
                  href={`/customers/${c.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-raised p-3.5 transition-colors hover:border-line-strong hover:bg-raised-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <span
                    aria-hidden
                    className="grid size-11 shrink-0 place-items-center rounded-xl bg-raised-2 text-lg font-black text-brand-2"
                  >
                    {(c.name ?? "؟").trim().charAt(0)}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 font-semibold">
                        <span className="truncate">{c.name ?? "بدون نام"}</span>
                        <TagBadge tag={c.tag} />
                      </div>
                      <div className="text-right text-sm text-muted" dir="ltr">
                        {c.phone}
                      </div>
                    </div>
                    <div className="text-sm text-muted sm:text-end">
                      {c.stats.purchaseCount > 0 ? (
                        <>
                          <span className="font-semibold text-ink-soft">
                            {formatNumber(c.stats.purchaseCount)} خرید · {formatToman(c.stats.totalSpent)}
                          </span>
                          {c.stats.lastPurchaseAt && (
                            <span className="block text-xs">آخرین خرید {formatDate(c.stats.lastPurchaseAt)}</span>
                          )}
                        </>
                      ) : c.stats.orderCount > 0 ? (
                        <>{formatNumber(c.stats.orderCount)} سفارش، هنوز بدون پرداخت</>
                      ) : (
                        "بدون سفارش"
                      )}
                    </div>
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
              <span className="text-sm text-muted">
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
