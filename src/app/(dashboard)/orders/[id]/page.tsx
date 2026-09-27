import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderStatusActions } from "@/components/orders/order-status-actions";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { PaymentPanel } from "@/components/orders/payment-panel";
import { OnlinePaymentsList } from "@/components/payments/online-payments-list";
import { OrderSmsList } from "@/components/orders/order-sms-list";
import { ShippingPanel } from "@/components/orders/shipping-panel";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatNumber, formatToman } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireSeller } from "@/server/auth";
import { amountDue, paymentState } from "@/server/orders/payment";
import { getOrder, orderCode } from "@/server/orders/queries";

export const metadata: Metadata = { title: "جزئیات سفارش | غلتک" };

export default async function OrderPage(props: PageProps<"/orders/[id]">) {
  const seller = await requireSeller();
  const { id } = await props.params;
  const order = await getOrder(seller.id, id);
  if (!order) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/orders" className="text-sm text-neutral-500 hover:underline">
          ← سفارش‌ها
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">
            سفارش <span dir="ltr" className="font-mono">{orderCode(order.id)}</span>
          </h1>
          <OrderStatusBadge status={order.status} />
          <Link
            href={`/orders/${order.id}/print`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "ms-auto")}
          >
            چاپ برگهٔ ارسال
          </Link>
        </div>
        <p className="text-sm text-neutral-500">
          ثبت در {formatDateTime(order.createdAt)}
          {order.source === "PURCHASE_LINK" ? " · از لینک خرید" : " · ثبت دستی"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>تغییر وضعیت</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderStatusActions orderId={order.id} status={order.status} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>پرداخت</CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentPanel
            orderId={order.id}
            state={paymentState(order)}
            method={order.paymentMethod}
            paidAtText={order.paidAt ? formatDateTime(order.paidAt) : null}
            receiptKey={order.receiptImageUrl}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>پیامک‌های مشتری</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderSmsList messages={order.smsMessages} />
        </CardContent>
      </Card>

      {order.paymentAttempts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>پرداخت‌های آنلاین</CardTitle>
          </CardHeader>
          <CardContent>
            <OnlinePaymentsList attempts={order.paymentAttempts} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>ارسال</CardTitle>
        </CardHeader>
        <CardContent>
          <ShippingPanel
            orderId={order.id}
            status={order.status}
            method={order.shippingMethod}
            cost={order.shippingCost}
            trackingCode={order.trackingCode}
            shippingStatus={order.shippingStatus}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>کالاها</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead className="text-neutral-600">
              <tr>
                <th className="py-2 text-start font-medium">کالا</th>
                <th className="py-2 text-start font-medium">تعداد</th>
                <th className="py-2 text-start font-medium">قیمت واحد</th>
                <th className="py-2 text-start font-medium">جمع</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => {
                const detail = [item.productVariant?.color, item.productVariant?.size]
                  .filter(Boolean)
                  .join(" / ");
                return (
                  <tr key={item.id} className="border-t border-neutral-200">
                    <td className="py-2">
                      <div className="font-medium">{item.product.name}</div>
                      {detail && <div className="text-xs text-neutral-500">{detail}</div>}
                    </td>
                    <td className="py-2">{formatNumber(item.quantity)}</td>
                    <td className="py-2 whitespace-nowrap">{formatToman(item.unitPrice)}</td>
                    <td className="py-2 whitespace-nowrap">
                      {formatToman(item.unitPrice * item.quantity)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-neutral-300 font-semibold">
                <td className="py-2" colSpan={3}>
                  جمع کالاها
                </td>
                <td className="py-2 whitespace-nowrap">{formatToman(order.totalPrice)}</td>
              </tr>
              {order.shippingCost !== null && (
                <>
                  <tr>
                    <td className="py-2" colSpan={3}>
                      هزینهٔ ارسال
                    </td>
                    <td className="py-2 whitespace-nowrap">{formatToman(order.shippingCost)}</td>
                  </tr>
                  <tr className="border-t border-neutral-300 font-semibold">
                    <td className="py-2" colSpan={3}>
                      مبلغ قابل پرداخت
                    </td>
                    <td className="py-2 whitespace-nowrap">{formatToman(amountDue(order))}</td>
                  </tr>
                </>
              )}
            </tfoot>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>مشتری و ارسال</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-[8rem_1fr]">
            <dt className="text-neutral-500">نام</dt>
            <dd>{order.customer.name ?? "بی‌نام"}</dd>
            <dt className="text-neutral-500">موبایل</dt>
            <dd dir="ltr" className="text-start">
              {order.customer.phone}
            </dd>
            <dt className="text-neutral-500">آدرس ارسال</dt>
            <dd>{order.shippingAddress ?? "ثبت نشده"}</dd>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
