import { formatNumber, formatToman } from "@/lib/format";
import type { FinanceTotals } from "./summary";

// What each finance number means, in plain Persian (spec §6.6), and how it
// moved since the previous period. Pure. The texts use the store's own
// figures where that helps ("از هر ۱۰۰ هزار تومان فروش، حدود ۳۷ هزار تومان").
// Owner only: these texts contain money.

export type Delta = { text: string; tone: "up" | "down" | "flat" };

/**
 * `amount`: percent change, up is good (sales, profit, orders).
 * `rate`: change in percentage points, up is good (margin).
 * `badRate`: percentage points, down is good (returns).
 */
export function compare(
  current: number | null,
  previous: number | null,
  kind: "amount" | "rate" | "badRate",
  against: string,
): Delta | undefined {
  if (current === null || previous === null) return undefined;
  let change: number;
  let unit: string;
  if (kind === "amount") {
    if (previous <= 0) return undefined;
    change = Math.round(((current - previous) / Math.abs(previous)) * 100);
    unit = "٪";
  } else {
    change = Math.round((current - previous) * 100);
    unit = " واحد";
  }
  if (change === 0) return { text: `مثل ${against}`, tone: "flat" };
  const good = kind === "badRate" ? change < 0 : change > 0;
  return {
    text: `${change > 0 ? "▲" : "▼"} ${formatNumber(Math.abs(change))}${unit} نسبت به ${against}`,
    tone: good ? "up" : "down",
  };
}

export type Metric = "sales" | "netProfit" | "margin" | "saleOrders" | "averageOrder" | "returnRate" | "cogs" | "expenses" | "grossProfit";

const percent = (r: number) => `${formatNumber(Math.round(r * 100))}٪`;

/** Only part of the sales have a cost: say so wherever profit is explained. */
function coverageNote(t: FinanceTotals): string {
  if (t.coverage === null || t.coverage >= 0.995) return "";
  return ` توجه: فقط ${percent(t.coverage)} فروش‌ها قیمت خرید دارند، پس سود واقعی کمتر از این عدد است. قیمت خرید محصولات را کامل کنید.`;
}

export function explain(metric: Metric, t: FinanceTotals): { title: string; body: string } {
  switch (metric) {
    case "sales":
      return {
        title: "فروش یعنی چه؟",
        body: "جمع مبلغ کالاهای سفارش‌هایی که پرداخت شده‌اند و لغو یا مرجوع نشده‌اند، بدون هزینهٔ ارسال. هر سفارش در روزی حساب می‌شود که ثبت شده است.",
      };
    case "netProfit": {
      const per100k = t.margin !== null && t.sales > 0 ? Math.round(t.margin * 100) : 0;
      // A loss is said as a loss, never as a negative amount "left for you".
      const perSale =
        per100k > 0
          ? ` در این بازه از هر ۱۰۰ هزار تومان فروش، حدود ${formatNumber(per100k)} هزار تومان برای شما ماند.`
          : per100k < 0
            ? ` در این بازه به‌ازای هر ۱۰۰ هزار تومان فروش، حدود ${formatNumber(-per100k)} هزار تومان زیان کردید.`
            : "";
      return {
        title: "سود خالص یعنی چه؟",
        body:
          "پولی که بعد از کم کردن قیمت خرید کالاها و همهٔ هزینه‌ها (تبلیغ، بسته‌بندی، پیک، اجاره…) برای شما می‌ماند." +
          perSale +
          coverageNote(t),
      };
    }
    case "margin":
      return {
        title: "حاشیهٔ سود یعنی چه؟",
        body:
          "چند درصد از فروش، سود خالص شماست. حاشیهٔ بالاتر یعنی از هر فروش پول بیشتری برایتان می‌ماند؛ با گران‌تر فروختن، ارزان‌تر خریدن یا کم کردن هزینه‌ها بالا می‌رود." +
          coverageNote(t),
      };
    case "saleOrders":
      return {
        title: "سفارش‌های پرداخت‌شده",
        body: `سفارش‌هایی که پولشان رسیده و لغو یا مرجوع نشده‌اند. در این بازه ${formatNumber(t.ordersPlaced)} سفارش ثبت شد و ${formatNumber(t.saleOrders)} تا پرداخت شد.`,
      };
    case "averageOrder":
      return {
        title: "میانگین هر سفارش",
        body:
          "فروش تقسیم بر تعداد سفارش‌های پرداخت‌شده: هر مشتری به‌طور میانگین چقدر خرید کرده است." +
          (t.averageOrder !== null ? ` در این بازه ${formatToman(t.averageOrder)}.` : "") +
          " پیشنهاد دادن یک کالای مکمل یا ارسال رایگان بالای یک مبلغ، این عدد را بالا می‌برد.",
      };
    case "returnRate":
      return {
        title: "نرخ مرجوعی",
        body:
          "از سفارش‌هایی که پرداخت شدند، چند درصد برگشت خوردند. اگر بالا رفت، توضیح و عکس محصولی را که بیشتر برمی‌گردد دقیق‌تر کنید (سایز، رنگ، جنس)." +
          (t.returnRate !== null ? ` در این بازه ${percent(t.returnRate)}.` : ""),
      };
    case "cogs":
      return {
        title: "قیمت خرید کالاها",
        body: "کالاهایی که فروختید برای خودتان چقدر تمام شده بود: قیمت خرید هر محصول ضرب در تعدادی که فروختید." + coverageNote(t),
      };
    case "expenses":
      return {
        title: "هزینه‌ها",
        body: "هر پولی که برای کار خرج کرده‌اید و در بخش هزینه‌ها ثبت کرده‌اید: تبلیغ، بسته‌بندی، پیک و پست، اجاره، حقوق، سرویس‌ها. هزینه‌های ماهانه خودکار هر ماه حساب می‌شوند.",
      };
    case "grossProfit":
      return {
        title: "سود ناخالص",
        body: "فروش منهای قیمت خرید کالاها، پیش از کم کردن هزینه‌هایی مثل تبلیغ و اجاره." + coverageNote(t),
      };
  }
}
