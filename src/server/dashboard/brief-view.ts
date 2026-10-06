import type { MemberRole } from "@/generated/prisma/enums";
import { formatNumber } from "@/lib/format";
import type { Attention } from "./attention";
import type { DailyBrief } from "./brief";
import { briefDelta, compactToman, type BriefDelta, type Compact } from "./brief-text";

// What the daily brief component receives (spec §7.1). It's a client
// component, so everything here is serialized into the page: money must not
// even be *in* the object for an operator (A10: money figures are the
// owner's). Hiding it in the component is not enough, so it's left out here.

/** Owner only. */
export type BriefMoney = {
  sales: Compact;
  /** Yesterday vs the same weekday last week; null without a base or on a quiet day. */
  delta: BriefDelta | null;
  /** The 7 days ending yesterday, oldest first, in tomans. */
  week: number[];
  weekTotal: Compact;
};

export type BriefView = {
  weekday: string;
  orders: number;
  /** Today's to-dos as short pills. */
  todos: { text: string; tone: "warning" | "danger" }[];
  /** null for operators: no sales, totals or chart values reach their browser. */
  money: BriefMoney | null;
};

export function buildBriefView(brief: DailyBrief, attention: Attention, role: MemberRole): BriefView {
  const todos: BriefView["todos"] = [
    ...(attention.receipts > 0 ? [{ text: `${formatNumber(attention.receipts)} رسید منتظر تأیید`, tone: "warning" as const }] : []),
    ...(attention.readyToShip > 0 ? [{ text: `${formatNumber(attention.readyToShip)} سفارش آمادهٔ ارسال`, tone: "danger" as const }] : []),
  ];
  const view: BriefView = { weekday: brief.yesterdayWeekday, orders: brief.orders, todos, money: null };
  if (role !== "OWNER") return view;

  return {
    ...view,
    money: {
      sales: compactToman(brief.sales),
      // A quiet day gets the week's total instead of "down 100%".
      delta: brief.sales > 0 ? briefDelta(brief.sales, brief.lastWeekSales, brief.yesterdayWeekday) : null,
      week: brief.week.map((d) => d.total),
      weekTotal: compactToman(brief.week.reduce((sum, d) => sum + d.total, 0)),
    },
  };
}
