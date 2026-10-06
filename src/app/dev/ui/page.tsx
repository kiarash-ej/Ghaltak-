import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PackageOpen, Plus } from "lucide-react";
import { InsightList } from "@/components/finance/insight-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { JsMarker } from "@/components/ui/js-marker";
import { Label } from "@/components/ui/label";
import { NavTabs } from "@/components/ui/nav-tabs";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Stat } from "@/components/ui/stat";
import type { Insight } from "@/server/finance/insights";

// Every component of the kit in both themes, for reviewing the design
// (spec §3.4). Development only: a 404 on a production build.

export const metadata: Metadata = { title: "UI kit | غلتک", robots: { index: false } };

const SAMPLE_INSIGHTS: Insight[] = [
  {
    id: "missing-costs",
    rule: 4,
    tone: "warn",
    title: "قیمت خرید بعضی محصولات ثبت نشده",
    body: "فقط ۷۸٪ فروش‌های این بازه قیمت خرید دارند؛ ۳ محصول فروش‌رفته قیمت خرید ندارد.",
    action: { label: "ثبت قیمت خرید", href: "/finance/products?missing=1" },
  },
  {
    id: "stale-unpaid",
    rule: 5,
    tone: "warn",
    title: "۵ سفارش بیش از ۲ روز منتظر پرداخت است",
    body: "روی هم حدود ۳٫۲ میلیون تومان. یک پیام کوتاه یادآوری معمولاً کار را تمام می‌کند.",
    action: { label: "سفارش‌های منتظر پرداخت", href: "/orders?status=PENDING_PAYMENT" },
  },
  { id: "smaller-orders", rule: 7, tone: "tip", title: "میانگین هر سفارش ۱۲٪ کمتر شد", body: "پیشنهاد یک کالای مکمل کنار خرید، سبد را بزرگ‌تر می‌کند." },
  { id: "best-weekday", rule: 12, tone: "tip", title: "پنجشنبه‌ها پرفروش‌ترین روز شماست", body: "حدود ۱٫۸ برابر یک روز معمولی." },
  { id: "sales-trend", rule: 1, tone: "good", title: "فروش ۲۳٪ بیشتر شد", body: "ببینید چه چیزی جواب داده تا تکرارش کنید." },
];

function Kit({ theme }: { theme: "light" | "dark" }) {
  return (
    <section data-app-theme={theme} className="flex min-w-0 flex-col gap-6 rounded-3xl p-6">
      <h2 className="text-xl font-black">{theme === "dark" ? "داشبورد (تیره)" : "روشن (صفحه‌های مشتری، چاپ)"}</h2>

      <div className="flex flex-wrap gap-2">
        <Button>سفارش جدید</Button>
        <Button variant="outline">لینک‌های خرید</Button>
        <Button variant="ghost">انصراف</Button>
        <Button variant="destructive">حذف</Button>
        <Button size="sm">کوچک</Button>
        <Button disabled>غیرفعال</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge>عادی</Badge>
        <Badge variant="success">پرداخت‌شده</Badge>
        <Badge variant="warning">رسید دریافت شد</Badge>
        <Badge variant="danger">مرجوعی</Badge>
        <Badge variant="count">۸</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          hero
          label="فروش"
          value={48.6}
          decimals={1}
          unit="میلیون تومان"
          delta={{ text: "▲ ۱۸٪ نسبت به ماه قبل", tone: "up" }}
          explain={{ title: "فروش یعنی چه؟", body: "جمع مبلغ کالاهای سفارش‌های پرداخت‌شده، بدون هزینهٔ ارسال." }}
        />
        <Stat
          index={1}
          label="سود خالص"
          value={18.2}
          decimals={1}
          unit="میلیون"
          delta={{ text: "▲ ۲۵٪", tone: "up" }}
          explain={{
            title: "سود خالص یعنی چه؟",
            body: "پولی که بعد از کم کردن قیمت خرید کالاها و همهٔ هزینه‌ها برای شما می‌ماند. این ماه از هر ۱۰۰ هزار تومان فروش، ۳۷ هزار تومان.",
          }}
        />
        <Stat index={2} label="حاشیهٔ سود" value={0.374} decimals={0} style="percent" delta={{ text: "▼ ۲ واحد", tone: "down" }} />
      </div>

      <NavTabs
        label="نمونهٔ زبانه‌ها"
        tabs={[
          { href: "/dev/ui", label: "خلاصه" },
          { href: "/dev/ui/sales", label: "فروش" },
          { href: "/dev/ui/profit", label: "سود محصولات" },
          { href: "/dev/ui/expenses", label: "هزینه‌ها" },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>کارت عادی</CardTitle>
          <CardDescription>توضیح کوتاه زیر عنوان</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`name-${theme}`}>نام محصول</Label>
            <Input id={`name-${theme}`} placeholder="مثلاً مانتو کتان" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`err-${theme}`}>قیمت (تومان)</Label>
            <Input id={`err-${theme}`} aria-invalid defaultValue="abc" />
            <p className="text-sm text-danger">قیمت را با عدد بنویسید.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>پیشنهادهای غلتک</CardTitle>
        </CardHeader>
        <CardContent>
          <InsightList insights={SAMPLE_INSIGHTS} />
        </CardContent>
      </Card>

      <Card variant="hero" className="p-5">
        <p className="text-sm font-bold text-muted">کارت hero</p>
        <p className="mt-1 text-2xl font-black">
          دیروز <span className="text-fire">۶٫۴ میلیون</span> فروختید.
        </p>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Sheet title="کار سریع" trigger={<Button variant="outline"><Plus className="size-4" aria-hidden /> باز کردن sheet پایین</Button>}>
          <p className="text-sm text-muted">سفارش جدید · لینک خرید جدید · محصول جدید</p>
        </Sheet>
        <Sheet side="end" title="منو" trigger={<Button variant="outline">باز کردن کشوی کناری</Button>}>
          <p className="text-sm text-muted">مالی و گزارش · مشتریان · تنظیمات</p>
        </Sheet>
      </div>

      <EmptyState icon={PackageOpen} title="هنوز محصولی ندارید" action={<Button>ساخت اولین محصول</Button>}>
        با قیمت، عکس و تنوع رنگ و سایز، هرکدام با موجودی خودش.
      </EmptyState>

      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    </section>
  );
}

export default function UiKitPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="grid gap-6 p-4 lg:grid-cols-2 lg:p-8">
      <JsMarker />
      <Kit theme="dark" />
      <Kit theme="light" />
    </main>
  );
}
