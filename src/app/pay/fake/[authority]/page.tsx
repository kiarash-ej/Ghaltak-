import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatToman } from "@/lib/format";
import { fakeGatewayAllowed, fakePaymentInfo } from "@/server/payments/fake-gateway";

// The fake gateway's "payment page", for the end-to-end test only. It does
// not exist in production or without E2E_FAKE_GATEWAY=1 (fake-gateway.ts).

export const metadata: Metadata = { title: "درگاه آزمایشی", robots: { index: false, follow: false } };

export default async function FakeGatewayPage(props: PageProps<"/pay/fake/[authority]">) {
  if (!fakeGatewayAllowed()) notFound();
  const { authority } = await props.params;
  const payment = fakePaymentInfo(authority);
  if (!payment) notFound();

  const back = (status: "OK" | "NOK") => {
    const url = new URL(payment.callbackUrl);
    url.searchParams.set("Authority", authority);
    url.searchParams.set("Status", status);
    return url.toString();
  };

  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-4 p-6">
      <h1 className="text-xl font-bold">درگاه آزمایشی</h1>
      <p className="text-sm text-neutral-600">فقط برای آزمایش خودکار. هیچ پولی جابه‌جا نمی‌شود.</p>
      <p>
        مبلغ: <span className="font-semibold">{formatToman(payment.amount)}</span>
      </p>
      <a href={back("OK")} className="rounded-lg bg-neutral-900 px-4 py-2 text-center text-white">
        پرداخت موفق
      </a>
      <a href={back("NOK")} className="rounded-lg border border-neutral-300 px-4 py-2 text-center">
        انصراف از پرداخت
      </a>
    </main>
  );
}
