import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PrintableOrder } from "@/server/orders/print";
import type { PaperSize } from "@/server/orders/print-request";
import type { PublicStoreProfile } from "@/server/store/profile";
import { PrintButton } from "./print-button";

// Shipping sheets (B9), one per order and one order per page, sized for A5 or
// A6 paper. Everything is local (logo from our own /uploads, the app's own
// font): nothing is fetched from outside when printing.

const PAPER = {
  // Screen preview at paper width; on paper, the @page margin does the spacing.
  A5: { page: "A5 portrait", margin: "8mm", sheet: "max-w-[148mm] min-h-[210mm] p-[8mm] text-sm" },
  A6: { page: "A6 portrait", margin: "5mm", sheet: "max-w-[105mm] min-h-[148mm] p-[5mm] text-xs" },
} as const;

function ShippingSheet({
  order,
  store,
  size,
}: {
  order: PrintableOrder;
  store: PublicStoreProfile | null;
  size: PaperSize;
}) {
  const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);
  return (
    <article
      aria-label={`برگهٔ ارسال سفارش ${order.code}`}
      className={cn(
        "flex w-full flex-col gap-4 rounded-lg border border-neutral-300 bg-white text-neutral-900",
        "print:max-w-none print:min-h-0 print:break-after-page print:rounded-none print:border-0 print:p-0 print:last:break-after-auto",
        PAPER[size].sheet,
      )}
    >
      <header className="flex items-start justify-between gap-3 border-b border-neutral-300 pb-3">
        <div className="flex min-w-0 items-center gap-2">
          {store?.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt="" className="size-12 shrink-0 rounded-md object-cover" />
          )}
          <div className="min-w-0">
            <p className="text-xs text-neutral-500">فرستنده</p>
            <p className="truncate font-bold">{store?.name ?? "فروشگاه"}</p>
            {store?.contactPhone && (
              <p dir="ltr" className="text-end">
                {store.contactPhone}
              </p>
            )}
          </div>
        </div>
        <div className="shrink-0 text-end">
          <p className="text-xs text-neutral-500">سفارش</p>
          <p dir="ltr" className="font-mono font-bold">
            {order.code}
          </p>
          <p className="text-xs text-neutral-500">{formatDate(order.createdAt)}</p>
        </div>
      </header>

      <section aria-label="گیرنده" className="flex flex-col gap-1 rounded-md border-2 border-neutral-900 p-3">
        <p className="text-xs text-neutral-500">گیرنده</p>
        <p className="text-base font-bold">{order.customerName ?? "بی‌نام"}</p>
        <p dir="ltr" className="text-end text-base font-semibold">
          {order.customerPhone}
        </p>
        <p className="leading-relaxed">{order.address ?? "آدرس ثبت نشده است."}</p>
      </section>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="whitespace-nowrap text-neutral-500">روش ارسال</dt>
        <dd>{order.shippingMethod ?? "—"}</dd>
        <dt className="whitespace-nowrap text-neutral-500">کد رهگیری</dt>
        <dd dir="ltr" className="text-end font-mono">
          {order.trackingCode ?? <span className="inline-block w-40 border-b border-dotted border-neutral-400">&nbsp;</span>}
        </dd>
      </dl>

      <table className="w-full">
        <thead className="text-neutral-500">
          <tr className="border-b border-neutral-300">
            <th className="py-1 text-start font-medium">کالا</th>
            <th className="py-1 text-end font-medium">تعداد</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-neutral-200">
              <td className="py-1">
                {item.name}
                {item.detail && <span className="text-neutral-500"> · {item.detail}</span>}
              </td>
              <td className="py-1 text-end font-semibold">{formatNumber(item.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-auto text-xs text-neutral-500">جمع اقلام: {formatNumber(itemCount)}</p>
    </article>
  );
}

export function PrintView({
  orders,
  store,
  size,
  backHref,
  sizeHref,
  empty,
}: {
  orders: PrintableOrder[];
  store: PublicStoreProfile | null;
  size: PaperSize;
  backHref: string;
  /** The same page on another paper size. */
  sizeHref: (size: PaperSize) => string;
  /** Shown instead of sheets when there is nothing to print. */
  empty: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <style>{`@page { size: ${PAPER[size].page}; margin: ${PAPER[size].margin}; }`}</style>

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-col gap-1">
          <Link href={backHref} className="text-sm text-neutral-500 hover:underline">
            ← بازگشت
          </Link>
          <h1 className="text-2xl font-bold">برگهٔ ارسال</h1>
          {orders.length > 0 && (
            <p className="text-sm text-neutral-600">{formatNumber(orders.length)} سفارش، هر سفارش در یک صفحه</p>
          )}
        </div>
        {orders.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <nav aria-label="اندازهٔ کاغذ" className="flex gap-1">
              {(["A5", "A6"] as const).map((s) => (
                <Link
                  key={s}
                  href={sizeHref(s)}
                  aria-current={s === size ? "page" : undefined}
                  className={cn(buttonVariants({ variant: s === size ? "default" : "outline", size: "sm" }))}
                >
                  {s}
                </Link>
              ))}
            </nav>
            <PrintButton />
          </div>
        )}
      </div>

      {orders.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-neutral-600">{empty}</p>
      ) : (
        <div className="flex flex-col items-center gap-6 print:block">
          {orders.map((order) => (
            <ShippingSheet key={order.id} order={order} store={store} size={size} />
          ))}
        </div>
      )}
    </div>
  );
}
