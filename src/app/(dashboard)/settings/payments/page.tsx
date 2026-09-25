import type { Metadata } from "next";
import { CardDetailsForm } from "@/components/payments/card-details-form";
import { GatewaySettingsForm } from "@/components/payments/gateway-settings-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSeller } from "@/server/auth";
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
  const [card, gateway] = await Promise.all([
    getCardDetailsForSettings(seller.id),
    getGatewayForSettings(seller.id),
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
    </div>
  );
}
