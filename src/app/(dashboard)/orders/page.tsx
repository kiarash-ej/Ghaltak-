import type { Metadata } from "next";
import Link from "next/link";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, formatNumber, formatToman } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireSeller } from "@/server/auth";
import { scheduleUnpaidReminders } from "@/server/notifications/schedule";
import { expireUnpaidLinkOrders } from "@/server/orders/expire-orders";
import { listOrders } from "@/server/orders/queries";
import { ORDER_STATUSES, STATUS_LABELS, isOrderStatus } from "@/server/orders/status";
import { PageHeader } from "@/components/ui/page-header";

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
  await scheduleUnpaidReminders(seller.id);
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
      <PageHeader
        title="سفارش‌ها"
        description="سفارش‌های دستی و لینک خرید، از ثبت تا تحویل."
        actions={
          <>
            {/* On phones these two live in the bottom bar and ➕. */}
            <Link href="/orders/links" className={cn(buttonVariants({ variant: "outline" }), "max-md:hidden")}>
              لینک‌های خرید
            </Link>
            <Link href="/orders/print?ready=1" className={cn(buttonVariants({ variant: "outline" }))}>
              چاپ سفارش‌های آمادهٔ ارسال
            </Link>
            <Link href="/orders/new" className={cn(buttonVariants(), "max-md:hidden")}>
              سفارش جدید
            </Link>
          </>
        }
      />

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
          className="h-10 rounded-lg border border-line-strong bg-transparent px-3 text-sm"
        >
          <option value="">همهٔ وضعیت‌ها</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline">
          جستجو
        </Button>
        {hasFilters && (
          <Link href="/orders" className={cn(buttonVariants({ variant: "ghost" }))}>
            پاک‌کردن فیلترها
          </Link>
        )}
      </form>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong p-10 text-center text-muted">
          {hasFilters ? (
            <p>با این فیلترها سفارشی پیدا نشد.</p>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <p>هنوز سفارشی ندارید.</p>
              <Link href="/orders/new" className={cn(buttonVariants())}>
                ثبت اولین سفارش
              </Link>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">{formatNumber(total)} سفارش</p>
            {/* The checkboxes in the table belong to this form (form="print-orders"). */}
            <form id="print-orders" action="/orders/print" method="GET">
              <Button type="submit" variant="outline" size="sm">
                چاپ برگهٔ ارسال سفارش‌های انتخاب‌شده
              </Button>
            </form>
          </div>
          {/* One table; on phones each row is restyled as a card (explicit roles keep
              it a table for screen readers when the display changes). */}
          <div className="relative overflow-x-auto md:rounded-xl md:border md:border-line">
            <table role="table" className="w-full text-sm md:min-w-[46rem]">
              <thead role="rowgroup" className="bg-raised-2 text-muted max-md:hidden">
                <tr role="row">
                  <th role="columnheader" className="w-10 p-3">
                    <span className="sr-only">انتخاب برای چاپ</span>
                  </th>
                  <th role="columnheader" className="p-3 text-start font-medium">کد</th>
                  <th role="columnheader" className="p-3 text-start font-medium">مشتری</th>
                  <th role="columnheader" className="p-3 text-start font-medium">تاریخ</th>
                  <th role="columnheader" className="p-3 text-start font-medium">مبلغ</th>
                  <th role="columnheader" className="p-3 text-start font-medium">وضعیت</th>
                  <th role="columnheader" className="p-3">
                    <span className="sr-only">جزئیات</span>
                  </th>
                </tr>
              </thead>
              <tbody role="rowgroup" className="max-md:flex max-md:flex-col max-md:gap-2.5">
                {items.map((o, i) => (
                  <tr
                    key={o.id}
                    role="row"
                    style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
                    className="animate-rise border-t border-line transition-colors md:hover:bg-raised-2/50 max-md:grid max-md:grid-cols-[auto_1fr_auto] max-md:items-center max-md:gap-x-3 max-md:gap-y-1.5 max-md:rounded-2xl max-md:border max-md:bg-raised max-md:p-3.5"
                  >
                    <td role="cell" className="p-3 max-md:col-start-1 max-md:row-span-3 max-md:row-start-1 max-md:self-start max-md:p-0 max-md:pt-0.5">
                      <input
                        type="checkbox"
                        name="id"
                        value={o.id}
                        form="print-orders"
                        aria-label={`انتخاب سفارش ${o.code} برای چاپ`}
                        className="size-4 accent-brand-2"
                      />
                    </td>
                    <td role="cell" className="p-3 font-mono max-md:col-start-2 max-md:row-start-2 max-md:p-0 max-md:text-right max-md:text-xs max-md:text-muted" dir="ltr">
                      {o.code}
                    </td>
                    <td role="cell" className="p-3 max-md:col-start-2 max-md:row-start-1 max-md:p-0">
                      <div className="font-semibold">{o.customerName ?? "بی‌نام"}</div>
                      <div className="text-right text-xs text-muted" dir="ltr">
                        {o.customerPhone}
                      </div>
                    </td>
                    <td role="cell" className="p-3 whitespace-nowrap max-md:col-start-2 max-md:row-start-3 max-md:p-0 max-md:text-xs max-md:text-muted">
                      {formatDate(o.createdAt)}
                    </td>
                    <td role="cell" className="p-3 whitespace-nowrap max-md:col-start-3 max-md:row-start-2 max-md:p-0 max-md:text-end">
                      <div className="font-semibold tabular-nums">{formatToman(o.totalPrice)}</div>
                      <div className="text-xs text-muted">
                        {formatNumber(o.itemCount)} کالا
                        {o.source === "PURCHASE_LINK" && " · لینک خرید"}
                      </div>
                    </td>
                    <td role="cell" className="p-3 max-md:col-start-3 max-md:row-start-1 max-md:p-0">
                      <div className="flex flex-wrap gap-1 max-md:justify-end">
                        <OrderStatusBadge status={o.status} />
                        {o.receiptPending && <Badge variant="warning">رسید منتظر بررسی</Badge>}
                        {o.onlinePaymentNeedsReview && <Badge variant="danger">پرداخت آنلاین نیاز به بررسی دارد</Badge>}
                      </div>
                    </td>
                    <td role="cell" className="p-3 text-end max-md:col-start-3 max-md:row-start-3 max-md:p-0">
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
