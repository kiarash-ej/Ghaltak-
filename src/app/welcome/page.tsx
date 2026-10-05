import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowUpLeft, Check, ChevronDown, ClipboardList, Link2, Package, Truck } from "lucide-react";
import { CUSTOMER_STEPS, FEATURE_GROUPS, HOW_IT_WORKS, LANDING_FAQS } from "@/components/landing/content";
import { LoginButton } from "@/components/landing/login-dialog";
import { SiteShell } from "@/components/landing/site-shell";
import styles from "../marketing.module.css";

export const metadata: Metadata = {
  title: "غلتک | مدیریت سفارش و فروش فروشگاه‌های آنلاین",
  description: "محصول و موجودی را ثبت کنید، لینک خرید بسازید و سفارش‌های فروشگاه اینستاگرامی یا تلگرامی‌تان را تا پرداخت و ارسال در غلتک پیگیری کنید.",
};

const stepIcons = [Package, Link2, Truck];

export default function WelcomePage() {
  return (
    <SiteShell onLanding>
      <main className={styles.site}>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <p className={styles.heroKicker}><span className={styles.kickerDot} /> برای فروشگاه‌های اینستاگرامی و تلگرامی</p>
            <h1 id="hero-title">همهٔ سفارش‌ها، <span>یک‌جا زیر نظر شما.</span></h1>
            <p className={styles.heroDescription}>
              محصول و موجودی را ثبت کنید، لینک خرید را برای مشتری بفرستید و سفارش‌ها را
              تا پرداخت و ارسال در غلتک پیگیری کنید.
            </p>
            <div className={styles.heroActions}>
              <LoginButton className={styles.primaryAction}>ساخت حساب <ArrowUpLeft size={20} aria-hidden="true" /></LoginButton>
              <Link href="#how-it-works" className={styles.textAction}>غلتک چطور کار می‌کند؟ <ArrowLeft size={18} aria-hidden="true" /></Link>
            </div>
            <p className={styles.heroAside}>ورود با کد پیامکی، بدون رمز عبور</p>
          </div>

          <div className={styles.heroVisual} role="img" aria-label="نمونه‌ای از لینک خرید، ثبت سفارش و آماده‌سازی ارسال در غلتک">
            <div className={styles.visualGlow} />
            <div className={styles.visualTrack} aria-hidden="true"><span /></div>
            <div className={`${styles.floatingNote} ${styles.messageNote}`}>
              <span className={styles.noteCaption}>لینک خرید فروشگاه</span>
              <span className={styles.messageText}>انتخاب رنگ و تعداد</span>
              <span className={styles.messageReply}>سفارش بدون ساخت حساب</span>
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
                  <div className={styles.productRow}><span className={styles.productThumb}><Package size={22} aria-hidden="true" /></span><div><strong>کیف دستی، رنگ سرمه‌ای</strong><small>۱ عدد · از لینک خرید</small></div></div>
                  <div className={styles.orderFooter}><span>مشخصات سفارش ثبت شد</span><span className={styles.orderProgress}><i /><i /><i /></span></div>
                </div>
                <div className={styles.previewMiniRows}><span /><span /><span /></div>
              </div>
            </div>
            <div className={`${styles.floatingNote} ${styles.shipNote}`}>
              <span className={styles.shipIcon}><Check size={17} strokeWidth={3} aria-hidden="true" /></span>
              <span><strong>آمادهٔ ارسال</strong><small>پرداخت تأیید شد</small></span>
            </div>
            <div className={styles.visualCaption}>نمونه‌ای از مدیریت سفارش در غلتک</div>
          </div>
        </section>

        <section id="how-it-works" className={styles.workflow} aria-labelledby="workflow-title">
          <div className={styles.sectionIntro}>
            <p className={styles.sectionLabel}>شروع کار با غلتک</p>
            <h2 id="workflow-title">از ثبت محصول تا ارسال سفارش.</h2>
            <p>سه قدم برای نظم دادن به کارهای روزانهٔ فروشگاه؛ اطلاعات هر سفارش را هم همیشه یک‌جا دارید.</p>
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

        <section className={styles.customerSection} aria-labelledby="customer-title">
          <div className={styles.customerCopy}>
            <div className={styles.sectionIntro}>
              <p className={styles.sectionLabel}>از نگاه مشتری</p>
              <h2 id="customer-title">یک لینک برای خرید، یک صفحه برای پیگیری.</h2>
              <p>مشتری از همان جایی که با فروشگاهتان آشنا شده، لینک خرید را باز می‌کند؛ بدون نصب برنامه و بدون ثبت‌نام.</p>
            </div>
            <ol className={styles.customerSteps}>
              {CUSTOMER_STEPS.map((step, index) => (
                <li key={step.title}>
                  <span className={styles.customerStepNumber} aria-hidden="true">{["۱", "۲", "۳"][index]}</span>
                  <div><h3>{step.title}</h3><p>{step.text}</p></div>
                </li>
              ))}
            </ol>
            <Link href="/help/purchase-links" className={styles.textAction}>راهنمای ساخت لینک خرید <ArrowLeft size={18} aria-hidden="true" /></Link>
          </div>
          <figure className={styles.customerPreview}>
            <div className={styles.receiptHeader}>
              <span className={styles.receiptIcon} aria-hidden="true"><Package size={25} /></span>
              <div><p>فروشگاه شما</p><strong>پیگیری سفارش</strong></div>
              <span className={styles.receiptCode}>شمارهٔ ۱۰۴۲</span>
            </div>
            <div className={styles.receiptProduct}><span>کیف دستی سرمه‌ای</span><span>۱ عدد</span></div>
            <ol className={styles.receiptTimeline}>
              <li><span className={styles.receiptDone}><Check size={16} aria-hidden="true" /></span><div><strong>سفارش ثبت شد</strong><p>مشخصات خرید و نشانی ثبت شد.</p></div></li>
              <li><span className={styles.receiptDone}><Check size={16} aria-hidden="true" /></span><div><strong>پرداخت تأیید شد</strong><p>سفارش برای ارسال آماده می‌شود.</p></div></li>
              <li><span className={styles.receiptCurrent}><Truck size={16} aria-hidden="true" /></span><div><strong>سفارش ارسال شد</strong><p>کد رهگیری را همین‌جا ببینید.</p></div></li>
            </ol>
            <figcaption>نمونه‌ای از صفحهٔ پیگیری سفارش</figcaption>
          </figure>
        </section>

        <section id="features" className={styles.featureSection} aria-labelledby="features-title">
          <div className={styles.featureInner}>
            <div className={styles.sectionIntro}>
              <p className={styles.sectionLabel}>امکانات غلتک</p>
              <h2 id="features-title">ابزارهای کار روزانهٔ فروشگاهتان.</h2>
              <p>اطلاعات محصول، مشتری و سفارش کنار هم است تا برای هر کاری بدانید از کجا شروع کنید.</p>
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

        <section id="questions" className={styles.faqSection} aria-labelledby="faq-title">
          <div className={styles.sectionIntro}>
            <h2 id="faq-title">پرسش‌های پیش از شروع</h2>
            <p>جواب سؤال‌هایی که شاید دربارهٔ کار با غلتک داشته باشید.</p>
            <Link href="/help" className={styles.textAction}>همهٔ راهنماها <ArrowLeft size={18} aria-hidden="true" /></Link>
          </div>
          <div className={styles.faqList}>
            {LANDING_FAQS.map((faq) => (
              <details key={faq.question} className={styles.faqItem}>
                <summary>{faq.question}<ChevronDown size={19} aria-hidden="true" /></summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={styles.bottomCallout} aria-labelledby="callout-title">
          <div><p>با ثبت اولین محصول شروع کنید.</p><h2 id="callout-title">سفارش بعدی را با غلتک مدیریت کنید.</h2></div>
          <div className={styles.calloutActions}>
            <LoginButton className={styles.calloutButton}>ورود یا ساخت حساب <ArrowUpLeft size={19} aria-hidden="true" /></LoginButton>
            <Link href="/help/getting-started" className={styles.calloutGuide}>راهنمای شروع کار</Link>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
