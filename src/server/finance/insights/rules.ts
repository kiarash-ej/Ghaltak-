import { formatNumber } from "@/lib/format";
import { compactToman } from "@/server/dashboard/brief-text";
import type { Insight, InsightFacts, ProductFacts, StockFacts } from "./types";

// The twelve advice rules (spec §6.5). Each is a pure function of the facts:
// it returns one insight or null, and stays quiet below its minimum data so a
// small store isn't told things two orders can't show. The texts are gentle
// suggestions, never certainties, and amounts are rounded for reading
// («حدود ۲۵۰ هزار تومان»).

const pct = (r: number) => `${formatNumber(Math.round(r * 100))}٪`;
const rough = (amount: number) => {
  const c = compactToman(Math.abs(amount));
  return `حدود ${formatNumber(c.value)} ${c.unit}`;
};
const more = (r: number) => `${pct(Math.abs(r))} ${r >= 0 ? "بیشتر" : "کمتر"}`;
// Thresholds compared with a little slack, so 30% − 10% counts as 20 points.
const EPS = 1e-9;
const atLeast = (value: number, threshold: number) => value >= threshold - EPS;
const below = (value: number, threshold: number) => !atLeast(value, threshold);
const largest = <T>(items: T[], by: (item: T) => number): T | undefined =>
  items.reduce<T | undefined>((best, item) => (best === undefined || by(item) > by(best) ? item : best), undefined);

/** Sales change vs the previous period when it is worth a word: ≥ 10%, on ≥ 5 previous sales. */
function salesChange(f: InsightFacts): number | null {
  if (f.previous.saleOrders < 5 || f.previous.sales <= 0) return null;
  const change = (f.current.sales - f.previous.sales) / f.previous.sales;
  return atLeast(Math.abs(change), 0.1) ? change : null;
}

/** 1. Sales went up or down by at least 10%. */
export function salesTrend(f: InsightFacts): Insight | null {
  const change = salesChange(f);
  if (change === null) return null;
  const up = change > 0;
  return {
    id: "sales-trend",
    rule: 1,
    tone: up ? "good" : "warn",
    title: `فروش ${more(change)} شد`,
    body:
      `${f.label} ${rough(f.current.sales)} فروختید و ${f.compareLabel} ${rough(f.previous.sales)}. ` +
      (up
        ? "ببینید چه چیزی جواب داده (یک تبلیغ، یک محصول تازه، یک لینک خرید) تا تکرارش کنید."
        : "شاید وقت یک استوری تازه یا پیشنهادی ویژه برای مشتری‌های قبلی باشد."),
  };
}

/** 2. When sales grew: the product behind most of the growth. */
export function growthDriver(f: InsightFacts): Insight | null {
  const change = salesChange(f);
  if (change === null || change <= 0) return null;
  const best = largest(f.products, (p) => p.sales - p.previousSales);
  if (!best || best.sales - best.previousSales <= 0) return null;
  const gain = best.sales - best.previousSales;
  const share = gain / (f.current.sales - f.previous.sales);
  return {
    id: "growth-driver",
    rule: 2,
    tone: "good",
    title: `«${best.name}» رشد فروش را جلو برد`,
    body:
      `فروش «${best.name}» نسبت به ${f.compareLabel} ${rough(gain)} بیشتر شد` +
      (share >= 0.3 && share <= 1 ? `؛ حدود ${pct(share)} از کل رشد فروش شما. ` : ". ") +
      "موجودی‌اش را کافی نگه دارید و شاید ارزش داشته باشد بیشتر نشانش بدهید.",
    action: { label: "موجودی این محصول", href: `/inventory?q=${encodeURIComponent(best.name)}` },
  };
}

const grossMargin = (p: ProductFacts) => (p.costedSales - p.cogs) / p.costedSales;

/** 3. A best seller (top 5 by sales) that leaves under 15% before expenses. */
export function thinMargin(f: InsightFacts): Insight | null {
  const top = [...f.products].filter((p) => p.sales > 0).sort((a, b) => b.sales - a.sales).slice(0, 5);
  // Its cost must be known for most of what sold, or the margin is a guess.
  const thin = top.find((p) => p.costedSales > 0 && p.costedSales >= p.sales / 2 && below(grossMargin(p), 0.15));
  if (!thin) return null;
  const margin = grossMargin(thin);
  const impact = Math.round(thin.sales * 0.1);
  return {
    id: "thin-margin",
    rule: 3,
    tone: "warn",
    title: margin < 0 ? `«${thin.name}» زیر قیمت خرید فروخته می‌شود` : `«${thin.name}» پرفروش است ولی کم‌سود`,
    body:
      (margin < 0
        ? `قیمت فروش «${thin.name}» از قیمت خریدش کمتر است و هر فروش برایتان ضرر دارد. `
        : `«${thin.name}» از پنج محصول پرفروش شماست ولی فقط ${pct(margin)} سود ناخالص دارد، تازه پیش از هزینه‌هایی مثل تبلیغ و ارسال. `) +
      `اگر ۱۰٪ گران‌تر بفروشید، با فروش همین بازه ${rough(impact)} بیشتر برایتان می‌ماند؛ یا شاید تأمین‌کنندهٔ ارزان‌تری پیدا شود.`,
    impactToman: impact,
    action: { label: "قیمت این محصول", href: `/products/${thin.productId}/edit` },
  };
}

/** 4. Under 90% of sales have a cost price: every profit figure is unsure. Pinned first. */
export function missingCosts(f: InsightFacts): Insight | null {
  const coverage = f.current.coverage;
  if (coverage === null || atLeast(coverage, 0.9)) return null;
  const missing = f.products.filter((p) => p.sales > 0 && p.costedSales < p.sales).length;
  return {
    id: "missing-costs",
    rule: 4,
    tone: "warn",
    title: "قیمت خرید بعضی محصولات ثبت نشده",
    body:
      `فقط ${pct(coverage)} فروش‌های این بازه قیمت خرید دارند` +
      (missing > 0 ? `؛ ${formatNumber(missing)} محصول فروش‌رفته قیمت خرید ندارد` : "") +
      ". تا ثبتش نکنید سود واقعی معلوم نیست و سودها بیشتر از واقع نشان داده می‌شوند. هنگام ثبت می‌توانید آن را برای فروش‌های قبلی هم به کار ببرید.",
    action: { label: "ثبت قیمت خرید", href: "/products" },
  };
}

/** 5. Orders waiting for payment for more than 48 hours. */
export function staleUnpaid(f: InsightFacts): Insight | null {
  const u = f.staleUnpaid;
  if (u.orders === 0) return null;
  const waiting = u.orders - u.withReceipt;
  return {
    id: "stale-unpaid",
    rule: 5,
    tone: "warn",
    title: `${formatNumber(u.orders)} سفارش بیش از ۲ روز منتظر پرداخت است`,
    body:
      `روی هم ${rough(u.amount)}. ` +
      (u.withReceipt > 0
        ? `${waiting === 0 ? "همه" : `${formatNumber(u.withReceipt)} تا`} رسید فرستاده‌اند و منتظر تأیید شما هستند. `
        : "") +
      (waiting > 0
        ? "یک پیام کوتاه یادآوری معمولاً کار را تمام می‌کند؛ اگر مشتری منصرف شده، سفارش را لغو کنید تا کالا به موجودی برگردد."
        : ""),
    impactToman: u.amount,
    action: { label: "سفارش‌های منتظر پرداخت", href: "/orders?status=PENDING_PAYMENT" },
  };
}

/** 6. Returns doubled, or reached 10%, with at least 3 returned orders. */
export function returnsJump(f: InsightFacts): Insight | null {
  const returned = f.current.returnedOrders;
  const rate = f.current.returnRate;
  if (returned < 3 || rate === null) return null;
  const before = f.previous.returnRate;
  const doubled = before !== null && rate > before && atLeast(rate, before * 2);
  if (below(rate, 0.1) && !doubled) return null;
  const worst = largest(f.products, (p) => p.returnedUnits);
  return {
    id: "returns-jump",
    rule: 6,
    tone: "warn",
    title: `نرخ مرجوعی به ${pct(rate)} رسید`,
    body:
      `${formatNumber(returned)} سفارش این بازه برگشت خورد` +
      (before !== null ? ` (${f.compareLabel}: ${pct(before)})` : "") +
      ". " +
      (worst && worst.returnedUnits >= 2 ? `بیشترین مرجوعی مال «${worst.name}» بوده است. ` : "") +
      "توضیح دقیق‌تر سایز، رنگ و جنس، و عکس واقعی محصول، معمولاً مرجوعی را کم می‌کند.",
    action: { label: "سفارش‌های مرجوعی", href: "/orders?status=RETURNED" },
  };
}

/** 7. Each order got at least 10% smaller, on ≥ 10 sales in both periods. */
export function smallerOrders(f: InsightFacts): Insight | null {
  const now = f.current.averageOrder;
  const before = f.previous.averageOrder;
  if (f.current.saleOrders < 10 || f.previous.saleOrders < 10 || now === null || before === null || before <= 0) return null;
  const change = (now - before) / before;
  if (!atLeast(-change, 0.1)) return null;
  return {
    id: "smaller-orders",
    rule: 7,
    tone: "tip",
    title: `میانگین هر سفارش ${more(change)} شد`,
    body: `هر سفارش این بازه به‌طور میانگین ${rough(now)} بود و ${f.compareLabel} ${rough(before)}. پیشنهاد یک کالای مکمل کنار خرید، یا ارسال رایگان بالای یک مبلغ مشخص، معمولاً سبد خرید را بزرگ‌تر می‌کند.`,
  };
}

/** 8. Expenses grew 20+ points faster than sales, or ads took 25%+ of sales. */
export function costsOutpacing(f: InsightFacts): Insight | null {
  const { current: c, previous: p } = f;
  const adsShare = c.sales > 0 && f.adsExpenses > 0 ? f.adsExpenses / c.sales : null;
  const action = { label: "هزینه‌ها", href: "/finance/expenses" };
  if (adsShare !== null && atLeast(adsShare, 0.25)) {
    return {
      id: "costs-outpacing",
      rule: 8,
      tone: "warn",
      title: `تبلیغ ${pct(adsShare)} فروش را می‌برد`,
      body: `${f.label} ${rough(f.adsExpenses)} خرج تبلیغ کردید و ${rough(c.sales)} فروختید. ببینید کدام تبلیغ واقعاً فروش آورده (یک لینک خرید جدا برای هر تبلیغ این را نشان می‌دهد) و روی همان بمانید.`,
      action,
    };
  }
  if (p.expenses <= 0 || p.sales <= 0) return null;
  const expenseGrowth = (c.expenses - p.expenses) / p.expenses;
  const salesGrowth = (c.sales - p.sales) / p.sales;
  if (below(expenseGrowth - salesGrowth, 0.2)) return null;
  return {
    id: "costs-outpacing",
    rule: 8,
    tone: "warn",
    title: "هزینه‌ها تندتر از فروش بالا رفت",
    body: `نسبت به ${f.compareLabel}، هزینه‌ها ${more(expenseGrowth)} و فروش ${more(salesGrowth)} شد. هزینه‌های این بازه را یک بار مرور کنید؛ شاید بعضی‌ها دیگر لازم نباشند.`,
    action,
  };
}

const variantName = (s: StockFacts) => {
  const detail = [s.color, s.size].filter(Boolean).join("، ");
  return detail ? `«${s.name}» (${detail})` : `«${s.name}»`;
};

/** 9. A best seller (top 5 by units, 30 days) with under 7 days of stock left at its pace. */
export function runningOut(f: InsightFacts): Insight | null {
  const low = f.stock
    .filter((s) => s.productUnits30 >= 5 && s.units30 >= 2)
    .map((s) => ({ ...s, days: Math.max(0, s.stock) / (s.units30 / 30) }))
    .filter((s) => s.days < 7)
    .sort((a, b) => a.days - b.days);
  if (low.length === 0) return null;
  const line = (s: (typeof low)[number]) =>
    s.stock <= 0 ? `${variantName(s)} تمام شده است` : `${variantName(s)} با این سرعت حدود ${formatNumber(Math.max(1, Math.round(s.days)))} روز دیگر تمام می‌شود`;
  const shown = low.slice(0, 3);
  return {
    id: "running-out",
    rule: 9,
    tone: "warn",
    title:
      low.length === 1
        ? `${variantName(low[0])} ${low[0].stock <= 0 ? "تمام شده" : "به‌زودی تمام می‌شود"}`
        : `${formatNumber(low.length)} کالای پرفروش به‌زودی تمام می‌شود`,
    body:
      (low.length === 1 ? "از پرفروش‌های ۳۰ روز اخیر است و " : "") +
      shown.map(line).join("؛ ") +
      (low.length > shown.length ? `؛ و ${formatNumber(low.length - shown.length)} مورد دیگر` : "") +
      ". اگر سفارش به تأمین‌کننده چند روز طول می‌کشد، الان وقتش است.",
    action: { label: "موجودی", href: "/inventory" },
  };
}

/** 10. A purchase link opened 50+ times this month that turns under 2% of visits into paid orders. */
export function linkNotConverting(f: InsightFacts): Insight | null {
  const link = largest(
    f.links.filter((l) => l.views >= 50 && below(l.paid / l.views, 0.02)),
    (l) => l.views,
  );
  if (!link) return null;
  const name = link.title ? `لینک «${link.title}»` : "یکی از لینک‌های خرید";
  return {
    id: "link-not-converting",
    rule: 10,
    tone: "tip",
    title: `${name} دیده می‌شود ولی کم فروش می‌آورد`,
    body:
      `این ماه ${formatNumber(link.views)} بار باز شده و ` +
      (link.paid === 0 ? "هنوز هیچ سفارش پرداخت‌شده‌ای نیاورده. " : `فقط ${formatNumber(link.paid)} سفارش پرداخت‌شده آورده. `) +
      "شاید قیمت، هزینهٔ ارسال یا عکس‌ها مشتری را منصرف می‌کند؛ صفحهٔ لینک را یک بار با چشم مشتری باز کنید.",
    action: { label: "لینک‌های خرید", href: "/orders/links" },
  };
}

/** 11. Returning customers bring 30%+ of sales (good), or under 10% with 20+ buyers (tip). */
export function repeatCustomers(f: InsightFacts): Insight | null {
  const c = f.customers;
  if (f.current.sales <= 0) return null;
  const share = c.returningSales / f.current.sales;
  const action = { label: "مشتری‌ها", href: "/customers" };
  if (atLeast(share, 0.3) && c.buyers >= 5) {
    return {
      id: "repeat-customers",
      rule: 11,
      tone: "good",
      title: `${pct(share)} فروش از مشتری‌های قدیمی بود`,
      body: `از ${formatNumber(c.buyers)} خریدار این بازه، ${formatNumber(c.returningBuyers)} نفر قبلاً هم از شما خریده بودند. مشتری وفادار ارزان‌ترین فروش را می‌آورد؛ یک پیام تشکر یا تخفیف کوچک برای خرید بعدی نگهش می‌دارد.`,
      action,
    };
  }
  if (below(share, 0.1) && c.buyers >= 20) {
    return {
      id: "repeat-customers",
      rule: 11,
      tone: "tip",
      title: "مشتری‌ها کمتر برای خرید دوم برمی‌گردند",
      body: `از ${formatNumber(c.buyers)} خریدار این بازه فقط ${formatNumber(c.returningBuyers)} نفر قبلاً هم خریده بودند. یک پیام پیگیری بعد از تحویل یا کد تخفیف برای خرید دوم، خریدار تازه را مشتری همیشگی می‌کند.`,
      action,
    };
  }
  return null;
}

const WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

/** 12. With 4+ weeks of sales, one weekday sells 1.4× an average day or more. */
export function bestWeekday(f: InsightFacts): Insight | null {
  const w = f.weekdays;
  if (w.daysSinceFirstSale === null || w.daysSinceFirstSale < 28 || w.orders < 20) return null;
  const total = w.sales.reduce((s, v) => s + v, 0);
  if (total <= 0) return null;
  const average = total / 7;
  const best = w.sales.indexOf(Math.max(...w.sales));
  const ratio = w.sales[best] / average;
  if (below(ratio, 1.4)) return null;
  const day = `${WEEKDAYS[best]}‌ها`;
  return {
    id: "best-weekday",
    rule: 12,
    tone: "tip",
    title: `${day} پرفروش‌ترین روز شماست`,
    body: `در ۸ هفتهٔ گذشته فروش ${day} حدود ${formatNumber(Math.round(ratio * 10) / 10)} برابر یک روز معمولی بوده است. تبلیغ و استوری را برای همان روز یا شب قبلش بگذارید و آن روز موجودی و پاسخ‌گویی را آماده نگه دارید.`,
  };
}

export const RULES: ((facts: InsightFacts) => Insight | null)[] = [
  salesTrend,
  growthDriver,
  thinMargin,
  missingCosts,
  staleUnpaid,
  returnsJump,
  smallerOrders,
  costsOutpacing,
  runningOut,
  linkNotConverting,
  repeatCustomers,
  bestWeekday,
];
