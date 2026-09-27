import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FEATURE_GROUPS, HOW_IT_WORKS, SMS_USES } from "@/components/landing/content";
import { LoginButton } from "@/components/landing/login-dialog";
import { SiteShell } from "@/components/landing/site-shell";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// The public landing page. Visitors without a session see it at / (src/proxy.ts
// rewrites / to /welcome); sellers see their dashboard there. Everything that
// needs an account opens the login popup. The text lives in
// src/components/landing/content.ts.

export const metadata: Metadata = {
  title: "غلتک | مدیریت فروش اینستاگرامی و تلگرامی",
  description:
    "لینک خرید برای اینستاگرام و تلگرام، سفارش و موجودی، کارت‌به‌کارت و پرداخت آنلاین، ارسال با کد رهگیری و پیامک خودکار به مشتری.",
};

const faDigit = (n: number) => n.toLocaleString("fa-IR");

export default function WelcomePage() {
  return (
    <SiteShell onLanding>
      <main className="flex-1">
        <section className="border-b border-neutral-200 bg-gradient-to-b from-neutral-50 to-white">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 py-14 text-center md:py-20">
            <Image
              src="/brand/logo-with-name.png"
              alt=""
              width={720}
              height={337}
              priority
              className="h-auto w-44 md:w-56"
            />
            <h1 className="max-w-2xl text-3xl leading-tight font-bold text-balance md:text-4xl md:leading-tight">
              فروش اینستاگرامی و تلگرامی، مرتب و بدون دفترچه
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-neutral-700">
              غلتک برای فروشگاه‌هایی است که در دایرکت و پیام‌رسان می‌فروشند. محصول‌ها و موجودی، سفارش‌ها، پرداخت و ارسال
              را در یک جا نگه دارید، و با یک لینک خرید، سفارش را از خود مشتری بگیرید.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <LoginButton className={cn(buttonVariants({ size: "lg" }))}>شروع کنید</LoginButton>
              <Link href="/help/getting-started" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
                راهنمای شروع کار
              </Link>
            </div>
            <p className="text-sm text-neutral-500">ورود با شمارهٔ موبایل و کد پیامکی؛ بدون رمز عبور.</p>
          </div>
        </section>

        <section aria-labelledby="how" className="mx-auto max-w-5xl px-4 py-14">
          <h2 id="how" className="text-center text-2xl font-bold">
            چطور کار می‌کند
          </h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {HOW_IT_WORKS.map((s, i) => (
              <li key={s.title} className="flex flex-col gap-2 rounded-2xl border border-neutral-200 p-5">
                <span
                  aria-hidden="true"
                  className="flex size-8 items-center justify-center rounded-full bg-neutral-900 text-sm font-bold text-white"
                >
                  {faDigit(i + 1)}
                </span>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="leading-7 text-neutral-600">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="features" aria-labelledby="features-title" className="scroll-mt-20 bg-neutral-50 py-14">
          <div className="mx-auto max-w-5xl px-4">
            <h2 id="features-title" className="text-center text-2xl font-bold">
              امکانات
            </h2>
            <p className="mt-2 text-center text-neutral-600">آنچه همین امروز در غلتک هست.</p>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {FEATURE_GROUPS.map((g) => (
                <section
                  key={g.id}
                  id={g.id}
                  aria-labelledby={`${g.id}-title`}
                  className="flex scroll-mt-20 flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-5"
                >
                  <div className="flex flex-col gap-1">
                    <h3 id={`${g.id}-title`} className="text-lg font-semibold">
                      {g.title}
                    </h3>
                    <p className="text-sm text-neutral-600">{g.summary}</p>
                  </div>
                  <ul className="flex list-disc flex-col gap-2 ps-5 leading-7 text-neutral-800 marker:text-neutral-400">
                    {g.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </section>

        <section id="sms" aria-labelledby="sms-title" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-14">
          <h2 id="sms-title" className="text-center text-2xl font-bold">
            پیامک‌هایی که غلتک می‌فرستد
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-center leading-7 text-neutral-600">
            فقط پیامک‌های خدماتی، هرکدام از یک قالب ثابت و دربارهٔ حساب یا سفارش خود گیرنده. غلتک پیامک تبلیغاتی نمی‌فرستد.
            فروشنده در تنظیمات انتخاب می‌کند کدام پیامک‌ها به مشتری‌هایش برود.
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SMS_USES.map((s) => (
              <li key={s.title} className="flex flex-col gap-1 rounded-xl border border-neutral-200 p-4">
                <span className="font-semibold">{s.title}</span>
                <span className="text-sm leading-6 text-neutral-600">{s.text}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-neutral-200 bg-neutral-900 text-white">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 py-12 text-center">
            <h2 className="text-2xl font-bold">فروشگاهتان را در چند دقیقه راه بیندازید</h2>
            <p className="max-w-xl leading-7 text-neutral-300">
              با شمارهٔ موبایلتان وارد شوید، نام و لوگوی فروشگاه را بگذارید، اولین محصول را ثبت کنید و لینک خریدش را بفرستید.
            </p>
            <LoginButton className={cn(buttonVariants({ size: "lg" }), "bg-white text-neutral-900 hover:bg-neutral-200")}>
              ورود یا ساخت حساب
            </LoginButton>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
