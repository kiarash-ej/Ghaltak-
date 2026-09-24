import { requireSeller } from "@/server/auth";

export default async function DashboardHome() {
  const seller = await requireSeller();

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-bold">خوش آمدید، {seller.name}</h1>
      <p className="text-neutral-600">
        از منوی کناری محصولات، مشتریان و سفارش‌های خود را مدیریت کنید.
      </p>
    </div>
  );
}
