import type { Metadata } from "next";
import { CardDetailsForm } from "@/components/payments/card-details-form";
import { GatewaySettingsForm } from "@/components/payments/gateway-settings-form";
import { SmsSettingsForm } from "@/components/payments/sms-settings-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/server/auth";
import { canUse, getPlanUsage } from "@/server/billing/usage";
import { SMS_KIND_LABELS } from "@/server/notifications/customer-sms-tokens";
import { saveSmsSettingsAction } from "@/server/notifications/settings-actions";
import { saveCardDetailsAction } from "@/server/payments/card-actions";
import { getCardDetailsForSettings } from "@/server/payments/card-store";
import { fakeGatewayAllowed } from "@/server/payments/fake-gateway";
import { saveGatewayAction, testGatewayAction } from "@/server/payments/gateway-actions";
import { getGatewayForSettings } from "@/server/payments/gateway-store";
import { QUOTA_SMS_KINDS, countSmsByKindThisMonth } from "@/server/sms/usage";

// «پرداخت» tab (Track B). B6: card-to-card details and the seller's own online
// gateway; B7 adds the customer SMS switches here.

export const metadata: Metadata = { title: "پرداخت | غلتک" };

export default async function PaymentSettingsPage() {
  const seller = await requireOwner();
  const [card, gateway, smsSwitches, smsAllowed, smsByKind, usage] = await Promise.all([
    getCardDetailsForSettings(seller.id),
    getGatewayForSettings(seller.id),
    prisma.seller.findUniqueOrThrow({
      where: { id: seller.id },
      select: { smsOnOrderPlaced: true, smsOnPaid: true, smsOnShipped: true, smsOnPaymentReminder: true },
    }),
    canUse(seller.id, "extraSms"),
    countSmsByKindThisMonth(seller.id),
    getPlanUsage(seller.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>کارت‌به‌کارت</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDetailsForm action={saveCardDetailsAction} initial={card} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>پرداخت آنلاین (درگاه خودتان)</CardTitle>
        </CardHeader>
        <CardContent>
          <GatewaySettingsForm
            saveAction={saveGatewayAction}
            testAction={testGatewayAction}
            initial={gateway}
            fakeAllowed={fakeGatewayAllowed()}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>پیامک به مشتری</CardTitle>
        </CardHeader>
        <CardContent>
          <SmsSettingsForm action={saveSmsSettingsAction} initial={smsSwitches} quotaReached={!smsAllowed} />

          <section aria-labelledby="sms-month" className="mt-6 max-w-lg border-t border-line pt-5">
            <h3 id="sms-month" className="text-sm font-bold">
              پیامک‌های این ماه
            </h3>
            <p className="mt-1 text-xs text-muted">
              {formatNumber(usage.sms.used)}
              {usage.sms.limit !== null && ` از ${formatNumber(usage.sms.limit)}`} پیامک سهمیهٔ این ماه فرستاده شده است.
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {QUOTA_SMS_KINDS.map((kind) => (
                <div key={kind} className="rounded-xl border border-line bg-raised px-3 py-2.5">
                  <dt className="text-xs text-muted">{SMS_KIND_LABELS[kind]}</dt>
                  <dd className="mt-0.5 text-lg font-extrabold tabular-nums">{formatNumber(smsByKind[kind])}</dd>
                </div>
              ))}
            </dl>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
