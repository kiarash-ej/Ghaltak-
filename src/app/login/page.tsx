import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ClipboardList, Package, Truck } from "lucide-react";
import { LoginForm } from "./login-form";
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
        <Link href="/" className={styles.authHeaderLink}><ArrowRight size={17} aria-hidden="true" /> بازگشت به صفحهٔ اصلی</Link>
      </header>

      <div className={styles.authShell}>
        <section className={styles.authFormSide} aria-labelledby="auth-title">
          <div className={styles.authFormInner}>
            <p className={styles.authEyebrow}><i aria-hidden="true" /> خوش آمدید</p>
            <h1 id="auth-title">فروشگاهتان از اینجا شروع می‌شود.</h1>
            <p className={styles.authLead}>برای ورود یا ساخت حساب، شمارهٔ موبایل خود را وارد کنید. یک کد تأیید برایتان پیامک می‌شود.</p>
            <LoginForm />
            <p className={styles.legal}>اطلاعات شما مطابق <Link href="/privacy">سیاست حفظ حریم خصوصی</Link> نگهداری می‌شود.</p>
          </div>
        </section>

        <aside className={styles.authArtSide} aria-label="آشنایی با غلتک">
          <div className={styles.authArtHeader}>
            <p>همهٔ فروشگاه، در یک جریان</p>
            <h2>فروش را راحت‌تر دنبال کنید.</h2>
            <span>از ثبت محصول تا پیگیری سفارش، کارهای هر روز فروشگاه کنار هم قرار می‌گیرند.</span>
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
