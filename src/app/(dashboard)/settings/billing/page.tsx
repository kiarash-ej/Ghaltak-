import type { Metadata } from "next";
import { PlanPayButton } from "@/components/billing/plan-pay-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PlanId } from "@/generated/prisma/enums";
import { formatDate, formatNumber, formatToman } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireOwner } from "@/server/auth";
import { startSubscriptionPaymentAction } from "@/server/billing/actions";
import { billingEnabled } from "@/server/billing/config";
import { PAID_PLAN_IDS, PLANS } from "@/server/billing/plans";
import { listInvoices } from "@/server/billing/queries";
import type { EffectiveState } from "@/server/billing/state";
import { retryStalePendingPayments } from "@/server/billing/subscription-payment";
import type { Quota } from "@/server/billing/types";
import { getPlanUsage } from "@/server/billing/usage";

// «اشتراک» tab (A9): plan, usage this month, the plans, invoices. Paying only
// while BILLING_ENABLED=true (docs/phase2/specs/A9-billing.md).
// Owner only (A10): operators get a 404.

export const metadata: Metadata = { title: "اشتراک | غلتک" };

const STATE_LABEL: Record<EffectiveState, { text: string; variant: "success" | "warning" | "danger" | "neutral" }> = {
  TRIAL: { text: "دورهٔ آزمایشی", variant: "neutral" },
  ACTIVE: { text: "فعال", variant: "success" },
  PAST_DUE: { text: "در انتظار تمدید", variant: "warning" },
  FREE: { text: "رایگان", variant: "neutral" },
};

const PAYMENT_MESSAGE: Record<string, { text: string; ok: boolean }> = {
  paid: { text: "پرداخت انجام شد و اشتراک شما تمدید شد.", ok: true },
  pending: { text: "نتیجهٔ پرداخت هنوز مشخص نیست. چند دقیقه دیگر این صفحه را دوباره باز کنید؛ اگر پولی کم شده باشد، ثبت می‌شود.", ok: false },
  canceled: { text: "پرداخت لغو شد. چیزی تغییر نکرد.", ok: false },
  failed: { text: "پرداخت انجام نشد. اگر مبلغی کم شده، بانک آن را برمی‌گرداند.", ok: false },
  mismatch: { text: "مبلغ پرداخت با فاکتور یکی نبود و اشتراک تمدید نشد. با پشتیبانی تماس بگیرید.", ok: false },
};

function planName(plan: PlanId): string {
  return plan === "TRIAL" ? "آزمایشی" : PLANS[plan].name;
}

function limitText(n: number): string {
  return formatNumber(n);
}

export default async function BillingSettingsPage(props: PageProps<"/settings/billing">) {
  const seller = await requireOwner();
  const sp = await props.searchParams;
  const enabled = billingEnabled();
  if (enabled) {
    await retryStalePendingPayments(seller.id).catch((err: unknown) =>
      console.error("[subscription payment] retry failed:", (err as Error)?.name),
    );
  }
  const [usage, invoices] = await Promise.all([getPlanUsage(seller.id), listInvoices(seller.id)]);
  const { effective } = usage;
  const state = STATE_LABEL[effective.state];
  const payment = typeof sp.payment === "string" ? PAYMENT_MESSAGE[sp.payment] : undefined;
  const renewing = effective.state === "ACTIVE" || effective.state === "PAST_DUE";

  return (
    <div className="flex flex-col gap-6">
      {payment && (
        <p
          role="status"
          className={cn(
            "rounded-lg border p-3 text-sm",
            payment.ok ? "border-green-200 bg-green-50 text-green-900" : "border-amber-200 bg-amber-50 text-amber-900",
          )}
        >
          {payment.text}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            پلن فعلی: {effective.state === "FREE" ? "رایگان" : planName(effective.plan)}
            <Badge variant={state.variant}>{state.text}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-neutral-700">
          {effective.periodEnd && effective.state !== "PAST_DUE" && (
            <p>پایان دوره: {formatDate(effective.periodEnd)}</p>
          )}
          {effective.state === "PAST_DUE" && effective.graceEndsAt && (
            <p className="text-red-700">
              دوره {formatDate(effective.periodEnd!)} تمام شد. تا {formatDate(effective.graceEndsAt)} تمدید کنید، وگرنه
              فروشگاه به سقف‌های پلن رایگان برمی‌گردد.
            </p>
          )}
          {effective.nextPlan && effective.nextPlanFrom && (
            <p>
              از {formatDate(effective.nextPlanFrom)} پلن شما {planName(effective.nextPlan)} می‌شود.
            </p>
          )}
          {!enabled && <p className="text-neutral-500">پرداخت اشتراک هنوز فعال نشده است و فعلاً هیچ محدودیتی اعمال نمی‌شود.</p>}
          <p className="text-neutral-500">سفارش گرفتن در هیچ پلنی محدود یا قطع نمی‌شود.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>مصرف این ماه</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <UsageItem label="سفارش" quota={{ used: usage.orders, limit: null }} />
            <UsageItem label="پیامک سفارش" quota={usage.sms} />
            <UsageItem label="کالای فعال" quota={usage.products} />
            <UsageItem label="اعضا" quota={usage.members} />
          </dl>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">پلن‌ها</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(["FREE", ...PAID_PLAN_IDS] as const).map((id) => {
            const plan = PLANS[id];
            const current = effective.limitsPlan === id && effective.state !== "TRIAL";
            return (
              <Card key={id} className={cn(current && "border-neutral-900")}>
                <CardHeader>
                  <CardTitle as="h3" className="flex items-center justify-between gap-2">
                    {plan.name}
                    {current && <Badge>پلن شما</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-sm">
                  <p className="text-base font-semibold">
                    {plan.monthlyPrice === 0 ? "رایگان" : `${formatToman(plan.monthlyPrice)} در ماه`}
                  </p>
                  <ul className="flex flex-col gap-1 text-neutral-700">
                    <li>{limitText(plan.limits.products)} کالای فعال</li>
                    <li>{limitText(plan.limits.sms)} پیامک سفارش در ماه</li>
                    <li>{plan.limits.members === 1 ? "فقط خودتان" : `${limitText(plan.limits.members)} عضو`}</li>
                    <li>
                      {id === "FREE"
                        ? "۱ دستگاه"
                        : `${limitText(plan.limits.devicesPerMember)} دستگاه برای هر عضو`}
                    </li>
                  </ul>
                  {enabled && id !== "FREE" && (
                    <PlanPayButton
                      action={startSubscriptionPaymentAction}
                      plan={id}
                      label={renewing && effective.plan === id ? "تمدید یک ماه" : "انتخاب و پرداخت"}
                      variant={current ? "default" : "outline"}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
        <p className="text-xs text-neutral-500">
          دورهٔ آزمایشی ۱۴ روز با امکانات پلن پایه است. تمدید زودتر از پایان دوره چیزی را از دست نمی‌دهد و ماه بعد
          از پایان دورهٔ فعلی شروع می‌شود؛ تغییر پلن هم از همان زمان اعمال می‌شود.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>فاکتورها</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-neutral-500">هنوز فاکتوری ندارید.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-neutral-200 text-sm">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    پلن {planName(inv.plan)} · {formatToman(inv.amount)}
                  </span>
                  <span className="text-neutral-600">
                    {inv.status === "PAID"
                      ? `${formatDate(inv.periodStart)} تا ${formatDate(inv.periodEnd)}`
                      : formatDate(inv.createdAt)}
                  </span>
                  <Badge variant={inv.status === "PAID" ? "success" : "warning"}>
                    {inv.status === "PAID" ? "پرداخت‌شده" : "پرداخت‌نشده"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UsageItem({ label, quota }: { label: string; quota: Quota }) {
  const full = quota.limit !== null && quota.used >= quota.limit;
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-sm text-neutral-600">{label}</dt>
      <dd className={cn("text-lg font-semibold", full && "text-red-700")}>
        {formatNumber(quota.used)}
        {quota.limit !== null && <span className="text-sm font-normal text-neutral-500"> از {formatNumber(quota.limit)}</span>}
      </dd>
    </div>
  );
}
