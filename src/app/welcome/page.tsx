import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowUpLeft, Check, ClipboardList, Link2, Package, Truck } from "lucide-react";
import { FEATURE_GROUPS, HOW_IT_WORKS, SMS_USES } from "@/components/landing/content";
import { LoginButton } from "@/components/landing/login-dialog";
import { SiteShell } from "@/components/landing/site-shell";
import styles from "../marketing.module.css";

export const metadata: Metadata = {
  title: "غلتک | فروش اینستاگرامی و تلگرامی، سر جای خودش",
  description: "از لینک خرید و موجودی تا سفارش، پرداخت و ارسال؛ غلتک کارهای فروشگاه آنلاین ایرانی را در یک مسیر روشن کنار هم می‌گذارد.",
};

const stepIcons = [Package, Link2, Truck];

export default function WelcomePage() {
  return (
    <SiteShell onLanding>
      <main className={styles.site}>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <p className={styles.heroKicker}><span className={styles.kickerDot} /> برای فروشنده‌هایی که همه‌جا می‌فروشند</p>
            <h1 id="hero-title">فروش اینستاگرامی و تلگرامی، <span>همه‌چیز سر جای خودش.</span></h1>
            <p className={styles.heroDescription}>
              از گفت‌وگو با مشتری تا تحویل سفارش، کارهای پراکندهٔ فروشگاهتان را در یک جا دنبال کنید؛
              محصول، موجودی، لینک خرید، پرداخت و ارسال.
            </p>
            <div className={styles.heroActions}>
              <LoginButton className={styles.primaryAction}>شروع کنید <ArrowUpLeft size={20} aria-hidden="true" /></LoginButton>
              <Link href="#how-it-works" className={styles.textAction}>دیدن مسیر کار <ArrowLeft size={18} aria-hidden="true" /></Link>
            </div>
            <p className={styles.heroAside}>ورود و ساخت حساب با کد پیامکی؛ بدون رمز عبور</p>
          </div>

          <div className={styles.heroVisual} role="img" aria-label="نمایی از مسیر پیام مشتری، سفارش و آماده‌سازی ارسال">
            <div className={styles.visualGlow} />
            <div className={styles.visualTrack} aria-hidden="true"><span /></div>
            <div className={`${styles.floatingNote} ${styles.messageNote}`}>
              <span className={styles.noteCaption}>پیام مشتری</span>
              <span className={styles.messageText}>«این رنگ موجوده؟»</span>
              <span className={styles.messageReply}>بله، آمادهٔ سفارشه ✨</span>
            </div>
            <div className={styles.appPreview}>
              <div className={styles.previewTop}>
                <div className={styles.previewBrand}><Image src="/brand/logo-symbol.png" alt="" width={28} height={28} /><span>غلتک</span></div>
                <span className={styles.previewTopLabel}>فروشگاه من</span>
              </div>
              <div className={styles.previewBody}>
                <div className={styles.previewHeading}>
                  <div><span className={styles.previewOverline}>امروز در فروشگاه</span><strong>سفارش‌ها، زیر نظر شما</strong></div>
                  <span className={styles.previewCircle} aria-hidden="true"><ClipboardList size={20} /></span>
                </div>
                <div className={styles.orderPreview}>
                  <div className={styles.orderPreviewTop}><span>سفارش تازه</span><span className={styles.statusPill}>در انتظار پرداخت</span></div>
                  <div className={styles.productRow}><span className={styles.productThumb}><Package size={22} aria-hidden="true" /></span><div><strong>کیف دستی، رنگ سرمه‌ای</strong><small>۱ عدد · آمادهٔ ثبت</small></div></div>
                  <div className={styles.orderFooter}><span>از محصول تا پرداخت</span><span className={styles.orderProgress}><i /><i /><i /></span></div>
                </div>
                <div className={styles.previewMiniRows}><span /><span /><span /></div>
              </div>
            </div>
            <div className={`${styles.floatingNote} ${styles.shipNote}`}>
              <span className={styles.shipIcon}><Check size={17} strokeWidth={3} aria-hidden="true" /></span>
              <span><strong>آمادهٔ ارسال</strong><small>مرحلهٔ بعد مشخص است</small></span>
            </div>
            <div className={styles.visualCaption}>یک مسیر روشن برای هر سفارش <span aria-hidden="true">↗</span></div>
          </div>
        </section>

        <section id="how-it-works" className={styles.workflow} aria-labelledby="workflow-title">
          <div className={styles.sectionIntro}>
            <p className={styles.sectionLabel}>جریان کار فروشگاه</p>
            <h2 id="workflow-title">فروش را از چند پنجره، به یک مسیر بیاورید.</h2>
            <p>هر بخش به بخش بعدی وصل است؛ از محصولی که ثبت می‌کنید تا سفارشی که به دست مشتری می‌رسد.</p>
          </div>
          <ol className={styles.steps}>
            {HOW_IT_WORKS.map((step, index) => {
              const Icon = stepIcons[index];
              return (
                <li className={styles.step} key={step.title}>
                  <div className={styles.stepTop}><span className={styles.stepIcon}><Icon size={24} strokeWidth={1.8} aria-hidden="true" /></span><span className={styles.stepNumber}>{["۰۱", "۰۲", "۰۳"][index]}</span></div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              );
            })}
          </ol>
        </section>

        <section id="features" className={styles.featureSection} aria-labelledby="features-title">
          <div className={styles.featureInner}>
            <div className={styles.sectionIntro}>
              <p className={styles.sectionLabel}>امکانات غلتک</p>
              <h2 id="features-title">امکاناتی برای کارهای واقعی هر روز.</h2>
              <p>آنچه همین امروز در غلتک در دسترس است، از فروش با لینک خرید تا کار تیمی.</p>
            </div>
            <div className={styles.featureGrid}>
              {FEATURE_GROUPS.map((group) => (
                <section key={group.id} id={group.id} aria-labelledby={`${group.id}-title`} className={styles.featureItem}>
                  <h3 id={`${group.id}-title`}>{group.title}</h3>
                  <p>{group.summary}</p>
                  <ul>{group.items.map((item) => <li key={item}>{item}</li>)}</ul>
                </section>
              ))}
            </div>
          </div>
        </section>

        <section id="sms" className={styles.smsSection} aria-labelledby="sms-title">
          <div className={styles.smsIntro}>
            <p className={styles.sectionLabel}>ارتباط با مشتری</p>
            <h2 id="sms-title">پیامک‌هایی که غلتک می‌فرستد</h2>
            <p>فقط پیامک‌های خدماتی مربوط به حساب یا سفارش گیرنده. فروشنده در تنظیمات انتخاب می‌کند کدام پیامک‌ها برای مشتریانش ارسال شود.</p>
          </div>
          <ul className={styles.smsGrid}>
            {SMS_USES.map((sms) => <li key={sms.kind}><strong>{sms.title}</strong><span>{sms.text}</span></li>)}
          </ul>
        </section>

        <section className={styles.bottomCallout} aria-labelledby="callout-title">
          <div><p>جای همه‌چیز در فروشگاه شما پیدا می‌شود.</p><h2 id="callout-title">برای سفارش بعدی آماده‌اید؟</h2></div>
          <LoginButton className={styles.calloutButton}>ورود یا ساخت حساب <ArrowUpLeft size={19} aria-hidden="true" /></LoginButton>
        </section>
      </main>
    </SiteShell>
  );
}
