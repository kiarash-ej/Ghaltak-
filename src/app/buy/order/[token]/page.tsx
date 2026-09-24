import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { formatDateTime, formatNumber, formatToman } from "@/lib/format";
import { UNPAID_ORDER_TTL_HOURS } from "@/server/orders/purchase-limits";
import { getPublicOrder } from "@/server/orders/purchase-links";

// The customer's confirmation/tracking page, reached by the order's public
// token. Shows the order only: no customer phone, no seller data.

export const metadata: Metadata = {
  title: "سفارش شما",
  robots: { index: false, follow: false },
};

export default async function PublicOrderPage(props: PageProps<"/buy/order/[token]">) {
  const { token } = await props.params;
  const order = await getPublicOrder(token);
  if (!order) notFound();

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 p-4 pb-10">
      <div className="flex flex-col gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-green-900">
        <h1 className="text-xl font-bold">سفارش شما ثبت شد</h1>
        <p>
          کد سفارش:{" "}
          <span dir="ltr" className="font-mono text-lg font-bold">
            {order.code}
          </span>
        </p>
        <p className="text-sm">این کد را نگه دارید. فروشنده برای هماهنگی پرداخت و ارسال با شما تماس می‌گیرد.</p>
        {order.status === "PENDING_PAYMENT" && (
          <p className="text-sm">
            سفارشی که تا {formatNumber(UNPAID_ORDER_TTL_HOURS)} ساعت پرداخت نشود، خودکار لغو می‌شود.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 text-sm text-neutral-600">
        <span>{formatDateTime(order.createdAt)}</span>
        <OrderStatusBadge status={order.status} />
      </div>

      <ul className="flex flex-col divide-y divide-neutral-200 rounded-xl border border-neutral-200">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 p-3 text-sm">
            <div>
              <div className="font-medium">{item.name}</div>
              <div className="text-xs text-neutral-500">
                {item.detail && `${item.detail} · `}
                {formatNumber(item.quantity)} عدد × {formatToman(item.unitPrice)}
              </div>
            </div>
            <div className="whitespace-nowrap">{formatToman(item.unitPrice * item.quantity)}</div>
          </li>
        ))}
        <li className="flex items-center justify-between p-3 font-semibold">
          <span>جمع کل</span>
          <span>{formatToman(order.totalPrice)}</span>
        </li>
      </ul>

      <p className="text-xs text-neutral-500">
        برای پیگیری وضعیت سفارش، همین صفحه را نگه دارید یا دوباره باز کنید.
      </p>
    </main>
  );
}
