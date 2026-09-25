import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BuyForm } from "@/components/orders/buy-form";
import { StoreHeader } from "@/components/store/store-header";
import { submitPurchaseAction } from "@/server/orders/buy-actions";
import { getPublicLink } from "@/server/orders/purchase-links";
import { getPublicStoreProfile } from "@/server/store/profile";

// Public page, no login. Shows only the products attached to this link.

export const metadata: Metadata = {
  title: "ثبت سفارش",
  robots: { index: false, follow: false },
};

export default async function BuyPage(props: PageProps<"/buy/[token]">) {
  const { token } = await props.params;
  const link = await getPublicLink(token);
  if (!link || link.products.length === 0) notFound();
  const store = await getPublicStoreProfile(link.sellerId);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 p-4 pb-10">
      {store && <StoreHeader profile={store} />}
      <h1 className="text-xl font-bold">{link.title ?? "ثبت سفارش"}</h1>
      <BuyForm products={link.products} action={submitPurchaseAction.bind(null, token)} />
    </main>
  );
}
