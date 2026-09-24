import type { Metadata } from "next";
import Link from "next/link";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, formatNumber, formatToman } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireSeller } from "@/server/auth";
import { expireUnpaidLinkOrders } from "@/server/orders/expire-orders";
import { listOrders } from "@/server/orders/queries";
import { ORDER_STATUSES, STATUS_LABELS, isOrderStatus } from "@/server/orders/status";

export const metadata: Metadata = { title: "سفارش‌ها | غلتک" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function OrdersPage(props: PageProps<"/orders">) {
  const seller = await requireSeller();
  const sp = await props.searchParams;
  const q = first(sp.q)?.trim() ?? "";
  const rawStatus = first(sp.status);
  const status = isOrderStatus(rawStatus) ? rawStatus : undefined;
  const requestedPage = Number(first(sp.page)) || 1;

  // Abandoned purchase-link orders are canceled lazily, so the list is current.
  await expireUnpaidLinkOrders(seller.id);
  const { items, total, page, pageCount } = await listOrders(seller.id, {
    q,
    status,
    page: requestedPage,
  });
  const hasFilters = q !== "" || status !== undefined;

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/orders?${qs}` : "/orders";
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">سفارش‌ها</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/orders/links" className={cn(buttonVariants({ variant: "outline" }))}>
            لینک‌های خرید
          </Link>
          <Link href="/orders/new" className={cn(buttonVariants())}>
            سفارش جدید
          </Link>
        </div>
      </div>

      <form method="GET" className="flex flex-wrap items-center gap-2">
        <Input
          name="q"
          defaultValue={q}
          placeholder="نام یا موبایل مشتری…"
          aria-label="جستجوی مشتری"
          className="max-w-xs"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          aria-label="فیلتر وضعیت"
          className="h-10 rounded-lg border border-neutral-300 bg-transparent px-3 text-sm"
        >
          <option value="">همهٔ وضعیت‌ها</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline">
          اعمال
        </Button>
        {hasFilters && (
          <Link href="/orders" className={cn(buttonVariants({ variant: "ghost" }))}>
            پاک‌کردن فیلترها
          </Link>
        )}
      </form>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-neutral-600">
          {hasFilters ? (
            <p>سفارشی با این فیلتر پیدا نشد.</p>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <p>هنوز سفارشی ثبت نشده است.</p>
              <Link href="/orders/new" className={cn(buttonVariants())}>
                ثبت اولین سفارش
              </Link>
            </div>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-neutral-500">{formatNumber(total)} سفارش</p>
          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="p-3 text-start font-medium">کد</th>
                  <th className="p-3 text-start font-medium">مشتری</th>
                  <th className="p-3 text-start font-medium">تاریخ</th>
                  <th className="p-3 text-start font-medium">مبلغ</th>
                  <th className="p-3 text-start font-medium">وضعیت</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((o) => (
                  <tr key={o.id} className="border-t border-neutral-200">
                    <td className="p-3 font-mono" dir="ltr">
                      {o.code}
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{o.customerName ?? "بی‌نام"}</div>
                      <div className="text-xs text-neutral-500" dir="ltr">
                        {o.customerPhone}
                      </div>
                    </td>
                    <td className="p-3 whitespace-nowrap">{formatDate(o.createdAt)}</td>
                    <td className="p-3 whitespace-nowrap">
                      <div>{formatToman(o.totalPrice)}</div>
                      <div className="text-xs text-neutral-500">
                        {formatNumber(o.itemCount)} قلم
                        {o.source === "PURCHASE_LINK" && " · لینک خرید"}
                      </div>
                    </td>
                    <td className="p-3">
                      <OrderStatusBadge status={o.status} />
                    </td>
                    <td className="p-3 text-end">
                      <Link
                        href={`/orders/${o.id}`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                      >
                        جزئیات
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
