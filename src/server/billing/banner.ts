import type { PlanId } from "@/generated/prisma/enums";
import { formatDate } from "@/lib/format";
import { REMINDER_DAYS_BEFORE_END } from "./plans";
import type { EffectivePlan } from "./state";

// The subscription warning above every dashboard page (A9). Pure. Nothing is
// shown while billing is off: nothing can end then.

export type Banner = { tone: "warning" | "danger"; text: string };

const DAY_MS = 24 * 60 * 60 * 1000;

export function subscriptionBanner(storedPlan: PlanId, effective: EffectivePlan, now: Date): Banner | null {
  if (!effective.enforced) return null;
  switch (effective.state) {
    case "PAST_DUE":
      return {
        tone: "danger",
        text: `اشتراک شما تمام شده است. تا ${formatDate(effective.graceEndsAt!)} تمدید کنید، وگرنه فروشگاه به سقف‌های پلن رایگان برمی‌گردد. سفارش گرفتن قطع نمی‌شود.`,
      };
    case "FREE":
      if (storedPlan === "FREE") return null;
      return {
        tone: "danger",
        text:
          storedPlan === "TRIAL"
            ? "دورهٔ آزمایشی تمام شد و فروشگاه روی پلن رایگان است. سفارش‌ها ادامه دارند، ولی افزودن کالا و پیامک محدود شده است."
            : "اشتراک تمدید نشد و فروشگاه روی پلن رایگان است. سفارش‌ها ادامه دارند، ولی افزودن کالا و پیامک محدود شده است.",
      };
    case "TRIAL":
    case "ACTIVE": {
      const end = effective.periodEnd!;
      if (end.getTime() - now.getTime() > REMINDER_DAYS_BEFORE_END * DAY_MS) return null;
      const what = effective.state === "TRIAL" ? "دورهٔ آزمایشی" : "اشتراک";
      return { tone: "warning", text: `${what} شما ${formatDate(end)} تمام می‌شود.` };
    }
  }
}
