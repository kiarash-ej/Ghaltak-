import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerEditForm } from "@/components/customers/customer-edit-form";
import { TagBadge } from "@/components/customers/tag-badge";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatDateTime, formatNumber, formatToman } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireSeller } from "@/server/auth";
import { setCustomerTagAction } from "@/server/customers/actions";
import { PROFILE_ORDER_LIMIT, getCustomerProfile } from "@/server/customers/queries";
import { CUSTOMER_TAGS, TAG_LABELS, suggestTag } from "@/server/customers/stats";
import { orderCode } from "@/server/orders/queries";

export const metadata: Metadata = { title: "مشتری | غلتک" };

export default async function CustomerPage(props: PageProps<"/customers/[id]">) {
  const seller = await requireSeller();
  const { id } = await props.params;

  // Scoped by sellerId: another seller's customer id behaves like a missing one.
  const profile = await getCustomerProfile(seller.id, id);
  if (!profile) notFound();
  const { customer, stats, orders, totalOrders } = profile;

  const suggestion = suggestTag({
    purchaseCount: stats.purchaseCount,
    lastPurchaseAt: stats.lastPurchaseAt,
    customerCreatedAt: customer.createdAt,
  });

  const statCards = [
    { label: "سفارش‌ها", value: formatNumber(stats.orderCount) },
    { label: "خرید پرداخت‌شده", value: formatNumber(stats.purchaseCount) },
    { label: "مجموع خرید", value: formatToman(stats.totalSpent) },
    { label: "میانگین هر خرید", value: stats.averageOrder === null ? "—" : formatToman(stats.averageOrder) },
    { label: "آخرین خرید", value: stats.lastPurchaseAt ? formatDate(stats.lastPurchaseAt) : "—" },
    { label: "مرجوعی", value: formatNumber(stats.returnCount) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{customer.name ?? "بدون نام"}</h1>
          <TagBadge tag={customer.tag} />
        </div>
        <Link href="/customers" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          بازگشت به مشتریان
        </Link>
      </div>

      <div className="flex flex-col gap-1 text-sm text-neutral-700">
        <a href={`tel:${customer.phone}`} dir="ltr" className="self-start underline">
          {customer.phone}
        </a>
        <p>{customer.address ?? "آدرسی ثبت نشده."}</p>
        <p className="text-neutral-500">مشتری از {formatDate(customer.createdAt)}</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-xl border border-neutral-200 p-3">
            <dt className="text-xs text-neutral-500">{s.label}</dt>
            <dd className="mt-1 font-semibold">{s.value}</dd>
          </div>
        ))}
      </dl>
      <p className="-mt-3 text-xs text-neutral-500">
        «خرید» یعنی سفارش پرداخت‌شده‌ای که لغو یا مرجوع نشده است.
      </p>

      <section className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm">
        <form action={setCustomerTagAction.bind(null, customer.id)} className="flex flex-wrap items-center gap-2">
          <span className="font-medium">برچسب:</span>
          {CUSTOMER_TAGS.map((t) => (
            <Button
              key={t}
              type="submit"
              name="tag"
              value={t}
              size="sm"
              variant={t === customer.tag ? "default" : "outline"}
              disabled={t === customer.tag}
              aria-pressed={t === customer.tag}
            >
              {TAG_LABELS[t]}
            </Button>
          ))}
        </form>
        <p className="text-neutral-700">
          پیشنهاد: <strong>{TAG_LABELS[suggestion.tag]}</strong>. {suggestion.reason}
          {suggestion.tag === customer.tag && <span className="text-neutral-500"> (همین برچسب فعلی است)</span>}
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>
            سوابق سفارش ({formatNumber(totalOrders)})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-sm text-neutral-600">این مشتری هنوز سفارشی ندارد.</p>
          ) : (
            <>
              {totalOrders > orders.length && (
                <p className="mb-2 text-xs text-neutral-500">
                  {formatNumber(PROFILE_ORDER_LIMIT)} سفارش آخر نمایش داده می‌شود.
                </p>
              )}
              <ul className="flex flex-col divide-y divide-neutral-200">
                {orders.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/orders/${o.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm hover:bg-neutral-50"
                    >
                      <span className="flex items-center gap-2">
                        <span dir="ltr" className="font-mono">{orderCode(o.id)}</span>
                        <OrderStatusBadge status={o.status} />
                      </span>
                      <span className="text-neutral-600">
                        {formatDateTime(o.createdAt)} · {formatNumber(o._count.items)} قلم ·{" "}
                        {formatToman(o.totalPrice)}
                        {o.source === "PURCHASE_LINK" && " · لینک خرید"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ویرایش اطلاعات مشتری</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomerEditForm
            customerId={customer.id}
            initial={{ name: customer.name, phone: customer.phone, address: customer.address }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
