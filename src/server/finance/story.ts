import { formatNumber } from "@/lib/format";
import { compactToman } from "@/server/dashboard/brief-text";
import type { FinanceTotals } from "./summary";

// A period told in one sentence (layout A's story, spec §6.4): «در مهر ۱۴۰۵،
// ۴۸٫۶ میلیون تومان فروختید و ۱۸٫۲ میلیون تومان سود خالص بردید.», then
// what that means and how it compares. Pure. Owner only (money).

export type StoryPart = string | { strong: string };
export type Story = { lead: StoryPart[]; detail: string };

const amount = (v: number) => {
  const c = compactToman(Math.abs(v));
  return `${formatNumber(c.value)} ${c.unit}`;
};
const pct = (r: number) => `${formatNumber(Math.round(Math.abs(r) * 100))}٪`;

export function periodStory(label: string, previousLabel: string, t: FinanceTotals, before: FinanceTotals): Story {
  if (t.saleOrders === 0) {
    return { lead: [`در ${label} فروشی ثبت نشد.`], detail: t.expenses > 0 ? `هزینه‌های این دوره ${amount(t.expenses)} بود.` : "" };
  }
  const lead: StoryPart[] = [
    `در ${label}، `,
    { strong: amount(t.sales) },
    " فروختید و ",
    { strong: amount(t.netProfit) },
    t.netProfit < 0 ? " زیان دادید." : " سود خالص بردید.",
  ];
  const parts: string[] = [];
  if (t.margin !== null && t.netProfit > 0) {
    parts.push(
      `یعنی از هر ۱۰۰ هزار تومانی که مشتری پرداخت کرد، حدود ${formatNumber(Math.round(t.margin * 100))} هزار تومان بعد از کم کردن قیمت خرید کالا و هزینه‌ها برای شما ماند.`,
    );
  }
  if (t.coverage !== null && t.coverage < 0.995) {
    parts.push(`فقط ${pct(t.coverage)} فروش‌ها قیمت خرید دارند، پس سود واقعی کمتر است.`);
  }
  if (before.sales > 0) {
    const change = (t.sales - before.sales) / before.sales;
    parts.push(
      Math.round(change * 100) === 0
        ? `فروش هم‌اندازهٔ ${previousLabel} بود.`
        : `فروش ${pct(change)} ${change > 0 ? "بیشتر" : "کمتر"} از ${previousLabel} بود.`,
    );
  }
  return { lead, detail: parts.join(" ") };
}
