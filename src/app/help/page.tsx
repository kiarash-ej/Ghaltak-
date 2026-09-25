import type { Metadata } from "next";
import Link from "next/link";
import { FAQS, GUIDES } from "./guides";

export const metadata: Metadata = { title: "راهنما | غلتک" };

export default function HelpIndexPage() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">راهنمای غلتک</h1>
        <p className="text-neutral-600">
          راهنماهای کوتاه برای کار روزانه با غلتک: از ساخت اولین محصول تا ارسال سفارش و دیدن گزارش فروش.
        </p>
      </div>

      <section aria-labelledby="guides-heading" className="flex flex-col gap-3">
        <h2 id="guides-heading" className="text-lg font-semibold">
          راهنماها
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {GUIDES.map((guide) => (
            <li key={guide.slug}>
              <Link
                href={`/help/${guide.slug}`}
                className="flex h-full flex-col gap-1 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm hover:bg-neutral-50"
              >
                <span className="font-semibold">{guide.title}</span>
                <span className="text-sm text-neutral-600">{guide.summary}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="faq-heading" className="flex flex-col gap-3">
        <h2 id="faq-heading" className="text-lg font-semibold">
          پرسش‌های پرتکرار
        </h2>
        <div className="flex flex-col divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
          {FAQS.map((faq) => (
            <details key={faq.q} className="group p-4">
              <summary className="cursor-pointer list-none font-medium marker:hidden">
                <span className="me-2 inline-block text-neutral-400 transition-transform group-open:rotate-90" aria-hidden="true">
                  ‹
                </span>
                {faq.q}
              </summary>
              <p className="mt-2 text-sm leading-7 text-neutral-700">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
