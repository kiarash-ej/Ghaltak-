import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintView } from "@/components/orders/print-view";
import { requireSeller } from "@/server/auth";
import { getPrintableOrders } from "@/server/orders/print";
import { paperSize } from "@/server/orders/print-request";
import { getPublicStoreProfile } from "@/server/store/profile";

export const metadata: Metadata = { title: "برگهٔ ارسال | غلتک" };

export default async function OrderPrintPage(props: PageProps<"/orders/[id]/print">) {
  const seller = await requireSeller();
  const { id } = await props.params;
  const size = paperSize((await props.searchParams).size);
  const [orders, store] = await Promise.all([
    getPrintableOrders(seller.id, { kind: "ids", ids: [id] }),
    getPublicStoreProfile(seller.id),
  ]);
  if (orders.length === 0) notFound();

  return (
    <PrintView
      orders={orders}
      store={store}
      size={size}
      backHref={`/orders/${id}`}
      sizeHref={(s) => `/orders/${id}/print${s === "A6" ? "?size=a6" : ""}`}
      empty=""
    />
  );
}
