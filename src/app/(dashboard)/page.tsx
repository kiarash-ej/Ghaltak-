import Link from "next/link";
import { DEFAULT_STORE_NAME } from "@/server/account";
import { requireSeller } from "@/server/auth";

export default async function DashboardHome() {
  const seller = await requireSeller();

  return (
    <div className="flex flex-col gap-4">
      {seller.name === DEFAULT_STORE_NAME && (
        <Link
          href="/settings"
          className="flex flex-col gap-1 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 hover:bg-amber-100"
        >
          <span className="font-semibold">تکمیل اطلاعات فروشگاه</span>
          <span className="text-sm">
            نام، لوگو و راه‌های تماس فروشگاهتان را وارد کنید تا مشتری آن‌ها را روی صفحهٔ خرید ببیند.
          </span>
        </Link>
      )}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">خوش آمدید، {seller.name}</h1>
        <p className="text-neutral-600">
          از منوی کناری محصولات، مشتریان و سفارش‌های خود را مدیریت کنید.
        </p>
      </div>
    </div>
  );
}
