import type { Metadata } from "next";
import Link from "next/link";
import { OrderForm } from "@/components/orders/order-form";
import { requireSeller } from "@/server/auth";
import { getOrderFormOptions } from "@/server/orders/queries";

export const metadata: Metadata = { title: "سفارش جدید | غلتک" };

export default async function NewOrderPage() {
  const seller = await requireSeller();
  const { customers, variants } = await getOrderFormOptions(seller.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/orders" className="text-sm text-neutral-500 hover:underline">
          ← سفارش‌ها
        </Link>
        <h1 className="text-2xl font-bold">سفارش جدید</h1>
      </div>
      <OrderForm customers={customers} variants={variants} />
    </div>
  );
}
