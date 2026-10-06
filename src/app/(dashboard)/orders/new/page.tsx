import type { Metadata } from "next";
import { OrderForm } from "@/components/orders/order-form";
import { requireSeller } from "@/server/auth";
import { getOrderFormOptions } from "@/server/orders/queries";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "سفارش جدید | غلتک" };

export default async function NewOrderPage() {
  const seller = await requireSeller();
  const { customers, variants } = await getOrderFormOptions(seller.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ href: "/orders", label: "سفارش‌ها" }}
        title="سفارش جدید"
        description="سفارشی که در دایرکت، تلفن یا حضوری گرفته‌اید."
      />
      <OrderForm customers={customers} variants={variants} />
    </div>
  );
}
