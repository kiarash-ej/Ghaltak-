import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { requireSeller } from "@/server/auth";
import { canExport, loginRole } from "@/server/exports/access";
import type { OrderFilterError } from "@/server/exports/orders";
import { ORDER_STATUSES, STATUS_LABELS } from "@/server/orders/status";

export const metadata: Metadata = { title: "خروجی داده | غلتک" };

const ERRORS: Record<OrderFilterError, string> = {
  from: "تاریخ «از» درست نیست. مثلاً ۱۴۰۵/۰۷/۰۱ بنویسید.",
  to: "تاریخ «تا» درست نیست. مثلاً ۱۴۰۵/۰۷/۳۰ بنویسید.",
  range: "تاریخ «از» باید پیش از تاریخ «تا» باشد.",
  status: "وضعیت انتخاب‌شده درست نیست.",
};

const isFilterError = (v: unknown): v is OrderFilterError => typeof v === "string" && v in ERRORS;

export default async function DataExportPage(props: PageProps<"/settings/data">) {
  const seller = await requireSeller();
  if (!canExport(await loginRole(seller))) {
    return (
      <p className="rounded-xl border border-neutral-200 p-6 text-neutral-700">
        فقط مالک فروشگاه می‌تواند از داده‌ها خروجی بگیرد.
      </p>
    );
  }
  const error = (await props.searchParams).error;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-7 text-neutral-600">
        از داده‌های فروشگاهتان فایل CSV بگیرید. فایل‌ها در اکسل با حروف فارسی درست باز می‌شوند. مبلغ‌ها به تومان و
        تاریخ‌ها شمسی و به وقت ایران است. شمارهٔ کارت، شبا و اطلاعات درگاه هرگز در این فایل‌ها نمی‌آید. بیشتر در{" "}
        <Link href="/privacy" className="font-medium text-neutral-900 underline underline-offset-4">
          حریم خصوصی
        </Link>
        .
      </p>

      <Card>
        <CardHeader>
          <CardTitle>محصولات و موجودی</CardTitle>
          <CardDescription>هر تنوع یک ردیف: قیمت، رنگ و سایز، کد کالا، موجودی و وضعیت آن، همان عدد صفحهٔ موجودی.</CardDescription>
        </CardHeader>
        <CardContent>
          <a href="/settings/data/export/products" className={cn(buttonVariants({ variant: "outline" }))} download>
            دریافت فایل محصولات
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>مشتریان</CardTitle>
          <CardDescription>
            نام، موبایل، آدرس، برچسب، و آمار خرید هر مشتری، همان اعداد صفحهٔ مشتری. موبایل‌ها با فاصله نوشته شده‌اند تا اکسل
            صفر اولشان را حذف نکند.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <a href="/settings/data/export/customers" className={cn(buttonVariants({ variant: "outline" }))} download>
            دریافت فایل مشتریان
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>سفارش‌ها</CardTitle>
          <CardDescription>
            هر سفارش یک ردیف، با کالاها، مبلغ، پرداخت و ارسال. ستون «فروش» همان تعریف گزارش فروش است. تاریخ‌ها را خالی
            بگذارید تا همهٔ سفارش‌ها بیاید.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="GET" action="/settings/data/export/orders" className="flex flex-col gap-4">
            {isFilterError(error) && (
              <p role="alert" className="text-sm text-red-600">
                {ERRORS[error]}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="from">از تاریخ</Label>
                <Input id="from" name="from" placeholder="۱۴۰۵/۰۷/۰۱" inputMode="numeric" dir="ltr" className="text-end" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="to">تا تاریخ (خود این روز هم می‌آید)</Label>
                <Input id="to" name="to" placeholder="۱۴۰۵/۰۷/۳۰" inputMode="numeric" dir="ltr" className="text-end" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="status">وضعیت</Label>
                <select
                  id="status"
                  name="status"
                  defaultValue=""
                  className="h-10 rounded-lg border border-neutral-300 bg-transparent px-3 text-sm"
                >
                  <option value="">همهٔ وضعیت‌ها</option>
                  {ORDER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <button type="submit" className={cn(buttonVariants({ variant: "outline" }))}>
                دریافت فایل سفارش‌ها
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
