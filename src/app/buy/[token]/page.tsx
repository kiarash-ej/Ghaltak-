import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { BuyForm } from "@/components/orders/buy-form";
import { StoreHeader } from "@/components/store/store-header";
import { submitPurchaseAction } from "@/server/orders/buy-actions";
import { isCountableView } from "@/server/orders/link-view-filter";
import { recordLinkView } from "@/server/orders/link-views";
import { getPublicLink } from "@/server/orders/purchase-links";
import { readSession } from "@/server/session";
import { THUMBNAIL_PX, thumbnail } from "@/server/storage/thumbnail";
import { getPublicStoreProfile } from "@/server/store/profile";

// Public page, no login. Shows only the products attached to this link.
// Each opening by a customer counts as a view in the link funnel (B8); the
// seller checking their own link doesn't.

export const metadata: Metadata = {
  title: "ثبت سفارش",
  robots: { index: false, follow: false },
};

export default async function BuyPage(props: PageProps<"/buy/[token]">) {
  const { token } = await props.params;
  const link = await getPublicLink(token);
  if (!link || link.products.length === 0) notFound();
  const ownSeller = (await readSession())?.sellerId === link.sellerId;
  if (!ownSeller && isCountableView(await headers())) {
    // After the response: counting never slows down or breaks the page.
    after(() => recordLinkView(link.linkId));
  }
  const store = await getPublicStoreProfile(link.sellerId);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 p-4 pb-10">
      {store && <StoreHeader profile={store} />}
      <h1 className="text-xl font-bold">{link.title ?? "ثبت سفارش"}</h1>
      <BuyForm
        products={link.products.map(({ imageUrl, ...p }) => ({
          ...p,
          image: imageUrl ? thumbnail(imageUrl, THUMBNAIL_PX.product) : null,
        }))}
        action={submitPurchaseAction.bind(null, token)}
      />
    </main>
  );
}
