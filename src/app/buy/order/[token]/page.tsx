import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { ReceiptUpload } from "@/components/orders/receipt-upload";
import { uploadReceiptAction } from "@/server/orders/payment-actions";
import { SHIPPING_STATUS_LABELS } from "@/server/orders/shipping";
import { formatDateTime, formatNumber, formatToman } from "@/lib/format";
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
      </div>

      {order.payment === "PAID" && (
        <p className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          پرداخت شما تأیید شد.
        </p>
      )}
      {(order.payment === "UNPAID" || order.payment === "RECEIPT_SUBMITTED") && (
        <section className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-4">
          <h2 className="font-semibold">پرداخت</h2>
          {order.payment === "RECEIPT_SUBMITTED" ? (
            <p className="text-sm text-amber-800">رسید شما دریافت شد و در انتظار تأیید فروشنده است.</p>
          ) : (
            <p className="text-sm text-neutral-600">
              اگر مبلغ را کارت به کارت واریز کرده‌اید، تصویر رسید را اینجا بفرستید.
            </p>
          )}
          <ReceiptUpload
            action={uploadReceiptAction.bind(null, token)}
            hasReceipt={order.payment === "RECEIPT_SUBMITTED"}
          />
        </section>
      )}

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
        {order.shippingCost !== null && (
          <li className="flex items-center justify-between p-3 text-sm">
            <span>هزینهٔ ارسال</span>
            <span>{formatToman(order.shippingCost)}</span>
          </li>
        )}
        <li className="flex items-center justify-between p-3 font-semibold">
          <span>{order.shippingCost !== null ? "مبلغ قابل پرداخت" : "جمع کل"}</span>
          <span>{formatToman(order.amountDue)}</span>
        </li>
      </ul>

      {(order.shipping.method || order.shipping.status !== "NOT_SHIPPED") && (
        <section className="flex flex-col gap-2 rounded-xl border border-neutral-200 p-4 text-sm">
          <h2 className="font-semibold">ارسال</h2>
          <p>
            وضعیت: {SHIPPING_STATUS_LABELS[order.shipping.status]}
            {order.shipping.method && ` · ${order.shipping.method}`}
          </p>
          {order.shipping.trackingCode && (
            <p>
              کد رهگیری:{" "}
              <span dir="ltr" className="select-all font-mono text-base font-bold">
                {order.shipping.trackingCode}
              </span>
            </p>
          )}
        </section>
      )}

      <p className="text-xs text-neutral-500">
        برای پیگیری وضعیت سفارش، همین صفحه را نگه دارید یا دوباره باز کنید.
      </p>
    </main>
  );
}
