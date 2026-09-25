import type { Metadata } from "next";
import { CardDetailsForm } from "@/components/payments/card-details-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSeller } from "@/server/auth";
import { saveCardDetailsAction } from "@/server/payments/card-actions";
import { getCardDetailsForSettings } from "@/server/payments/card-store";

// «پرداخت» tab (Track B). B6: card-to-card details, then the online gateway;
// B7 adds the customer SMS switches here.

export const metadata: Metadata = { title: "پرداخت | غلتک" };

export default async function PaymentSettingsPage() {
  const seller = await requireSeller();
  const card = await getCardDetailsForSettings(seller.id);

  return (
    <Card>
      <CardHeader>
        <CardTitle>کارت‌به‌کارت</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDetailsForm action={saveCardDetailsAction} initial={card} />
      </CardContent>
    </Card>
  );
}
