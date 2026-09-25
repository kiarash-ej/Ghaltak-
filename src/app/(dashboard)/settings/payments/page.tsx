import type { Metadata } from "next";
import { CardDetailsForm } from "@/components/payments/card-details-form";
import { GatewaySettingsForm } from "@/components/payments/gateway-settings-form";
import { SmsSettingsForm } from "@/components/payments/sms-settings-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireSeller } from "@/server/auth";
import { canUse } from "@/server/billing/can-use.stub";
import { saveSmsSettingsAction } from "@/server/notifications/settings-actions";
import { saveCardDetailsAction } from "@/server/payments/card-actions";
import { getCardDetailsForSettings } from "@/server/payments/card-store";
import { fakeGatewayAllowed } from "@/server/payments/fake-gateway";
import { saveGatewayAction, testGatewayAction } from "@/server/payments/gateway-actions";
import { getGatewayForSettings } from "@/server/payments/gateway-store";

// «پرداخت» tab (Track B). B6: card-to-card details and the seller's own online
// gateway; B7 adds the customer SMS switches here.

export const metadata: Metadata = { title: "پرداخت | غلتک" };

export default async function PaymentSettingsPage() {
  const seller = await requireSeller();
  const [card, gateway, smsSwitches, smsAllowed] = await Promise.all([
    getCardDetailsForSettings(seller.id),
    getGatewayForSettings(seller.id),
    prisma.seller.findUniqueOrThrow({
      where: { id: seller.id },
      select: { smsOnOrderPlaced: true, smsOnPaid: true, smsOnShipped: true },
    }),
    canUse(seller.id, "extraSms"),
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
        </CardContent>
      </Card>
    </div>
  );
}
