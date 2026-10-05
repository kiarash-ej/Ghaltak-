import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ClipboardList, Package, Truck } from "lucide-react";
import { LoginForm } from "./login-form";
import { ThemeToggle } from "@/components/landing/theme-toggle";
import styles from "../marketing.module.css";

export const metadata: Metadata = {
  title: "ورود یا ساخت حساب | غلتک",
  description: "با شمارهٔ موبایل و کد پیامکی وارد غلتک شوید یا حساب فروشگاه خود را بسازید.",
};

export default function LoginPage() {
  return (
    <main className={styles.authPage}>
      <header className={styles.authHeader}>
        <Link href="/" className={styles.brand} aria-label="غلتک، صفحهٔ اصلی">
          <Image src="/brand/logo-symbol.png" alt="" width={48} height={48} priority />
          <span>غلتک</span>
        </Link>
        <div className={styles.authHeaderActions}>
          <ThemeToggle />
          <Link href="/" className={styles.authHeaderLink}><ArrowRight size={17} aria-hidden="true" /> بازگشت به صفحهٔ اصلی</Link>
        </div>
      </header>

      <div className={styles.authShell}>
        <section className={styles.authFormSide} aria-labelledby="auth-title">
          <div className={styles.authFormInner}>
            <p className={styles.authEyebrow}><i aria-hidden="true" /> خوش آمدید</p>
            <h1 id="auth-title">ورود یا ساخت حساب</h1>
            <p className={styles.authLead}>با شمارهٔ موبایل و کد تأیید وارد شوید. اگر بار اول است که از غلتک استفاده می‌کنید، حسابتان بعد از تأیید شماره ساخته می‌شود.</p>
            <LoginForm />
            <p className={styles.legal}>اطلاعات شما طبق <Link href="/privacy">سیاست حریم خصوصی</Link> غلتک نگهداری می‌شود.</p>
          </div>
        </section>

        <aside className={styles.authArtSide} aria-label="آشنایی با غلتک">
          <div className={styles.authArtHeader}>
            <p>مدیریت روزانهٔ فروشگاه</p>
            <h2>از موجودی کالا تا ارسال سفارش، یک‌جا.</h2>
            <span>محصولات را ثبت کنید، لینک خرید بسازید و وضعیت پرداخت و ارسال هر سفارش را پیگیری کنید.</span>
          </div>
          <div className={styles.authArt} aria-hidden="true">
            <div className={styles.authArtRoute} />
            <div className={styles.authArtMark}><Image src="/brand/logo-symbol.png" alt="" width={130} height={130} /></div>
            <span className={`${styles.authArtBadge} ${styles.authBadgeOne}`}><Package size={17} /> محصول و موجودی</span>
            <span className={`${styles.authArtBadge} ${styles.authBadgeTwo}`}><ClipboardList size={17} /> سفارش و پرداخت</span>
            <span className={`${styles.authArtBadge} ${styles.authBadgeThree}`}><Truck size={17} /> ارسال و پیگیری</span>
          </div>
          <p className={styles.authArtFooter}><strong>غلتک</strong> برای فروشگاه‌های آنلاین ایرانی ساخته شده است.</p>
        </aside>
      </div>
    </main>
  );
}
