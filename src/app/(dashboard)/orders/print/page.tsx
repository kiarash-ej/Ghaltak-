import type { Metadata } from "next";
import { PrintView } from "@/components/orders/print-view";
import { requireSeller } from "@/server/auth";
import { getPrintableOrders } from "@/server/orders/print";
import { paperSize, parsePrintRequest } from "@/server/orders/print-request";
import { getPublicStoreProfile } from "@/server/store/profile";

// Several shipping sheets at once: the orders ticked in /orders (?id=…&id=…),
// or every order waiting to be shipped (?ready=1).

export const metadata: Metadata = { title: "برگهٔ ارسال | غلتک" };

export default async function OrdersPrintPage(props: PageProps<"/orders/print">) {
  const seller = await requireSeller();
  const sp = await props.searchParams;
  const selection = parsePrintRequest(sp);
  const size = paperSize(sp.size);
  const [orders, store] = await Promise.all([
    getPrintableOrders(seller.id, selection),
    getPublicStoreProfile(seller.id),
  ]);

  const sizeHref = (s: string) => {
    const params = new URLSearchParams();
    if (selection.kind === "ready") params.set("ready", "1");
    else for (const id of selection.ids) params.append("id", id);
    if (s === "A6") params.set("size", "a6");
    return `/orders/print?${params}`;
  };

  return (
    <PrintView
      orders={orders}
      store={store}
      size={size}
      backHref="/orders"
      sizeHref={sizeHref}
      empty={
        selection.kind === "ready"
          ? "سفارشی در انتظار ارسال نیست. سفارش‌های پرداخت‌شده و در حال آماده‌سازی اینجا می‌آیند."
          : "سفارشی برای چاپ انتخاب نشده است. در فهرست سفارش‌ها سفارش‌ها را علامت بزنید."
      }
    />
  );
}
