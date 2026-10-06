import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { requireOwner } from "@/server/auth";
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
  await requireOwner(); // an operator gets a 404 (A10)
  const error = (await props.searchParams).error;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-7 text-muted">
        از اطلاعات فروشگاهتان فایل CSV بگیرید. این فایل‌ها در اکسل با حروف فارسی درست باز می‌شوند. مبلغ‌ها به تومان و
        تاریخ‌ها شمسی و به وقت ایران‌اند. شمارهٔ کارت، شبا و اطلاعات درگاه هیچ‌وقت در این فایل‌ها نمی‌آید. توضیح بیشتر
        در صفحهٔ{" "}
        <Link href="/privacy" className="font-medium text-ink underline underline-offset-4">
          حریم خصوصی
        </Link>
        .
      </p>

      <Card>
        <CardHeader>
          <CardTitle>محصولات و موجودی</CardTitle>
          <CardDescription>برای هر تنوع یک ردیف، با قیمت، رنگ و سایز، کد کالا، موجودی و وضعیت موجودی؛ همان اعدادی که در صفحهٔ موجودی می‌بینید.</CardDescription>
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
            نام، موبایل، آدرس، برچسب و آمار خرید هر مشتری؛ همان اعدادی که در صفحهٔ مشتری می‌بینید. شمارهٔ موبایل‌ها با
            فاصله نوشته شده تا اکسل صفر اولشان را حذف نکند.
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
            برای هر سفارش یک ردیف، با محصولات، مبلغ، پرداخت و ارسال. ستون «جزو فروش» با همان تعریف گزارش فروش پر
            می‌شود. برای گرفتن همهٔ سفارش‌ها، تاریخ‌ها را خالی بگذارید.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="GET" action="/settings/data/export/orders" className="flex flex-col gap-4">
            {isFilterError(error) && (
              <p role="alert" className="text-sm text-danger">
                {ERRORS[error]}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="from">از تاریخ</Label>
                <Input id="from" name="from" placeholder="۱۴۰۵/۰۷/۰۱" inputMode="numeric" dir="ltr" className="text-end" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="to">تا تاریخ (خود این روز هم حساب می‌شود)</Label>
                <Input id="to" name="to" placeholder="۱۴۰۵/۰۷/۳۰" inputMode="numeric" dir="ltr" className="text-end" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="status">وضعیت</Label>
                <select
                  id="status"
                  name="status"
                  defaultValue=""
                  className="h-10 rounded-lg border border-line-strong bg-transparent px-3 text-sm"
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
