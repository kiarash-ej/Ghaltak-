import type { Metadata } from "next";
import { CopyLinkButton } from "@/components/orders/copy-link-button";
import { FUNNEL_NOTE, LinkFunnelStats } from "@/components/orders/link-funnel";
import { PurchaseLinkForm } from "@/components/orders/purchase-link-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatNumber } from "@/lib/format";
import { requireSeller } from "@/server/auth";
import { setPurchaseLinkActiveAction } from "@/server/orders/link-actions";
import { listLinkableProducts, listPurchaseLinks } from "@/server/orders/purchase-links";
import { getLinkFunnel } from "@/server/reports/link-funnel";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "لینک‌های خرید | غلتک" };

export default async function PurchaseLinksPage() {
  const seller = await requireSeller();
  const [links, products, funnel] = await Promise.all([
    listPurchaseLinks(seller.id),
    listLinkableProducts(seller.id),
    getLinkFunnel(seller.id),
  ]);
  const funnelByLink = new Map(funnel.links.map((l) => [l.linkId, l]));
  const noActivity = { views: 0, orders: 0, paid: 0, conversion: null };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="لینک‌های خرید"
        description="لینک را در دایرکت یا تلگرام بفرستید. مشتری بدون ثبت‌نام سفارش می‌دهد و سفارشش به فهرست سفارش‌های شما اضافه می‌شود."
      />

      <Card>
        <CardHeader>
          <CardTitle>لینک جدید</CardTitle>
        </CardHeader>
        <CardContent>
          <PurchaseLinkForm products={products} />
        </CardContent>
      </Card>

      {links.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong p-10 text-center text-muted">
          هنوز لینکی نساخته‌اید.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">
            آمار لینک‌ها از اول این ماه ({formatDate(funnel.since)}) حساب شده است.
          </p>
          <ul className="flex flex-col gap-3">
            {links.map((link) => (
              <li key={link.id} className="flex flex-col gap-3 rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{link.title ?? "بدون عنوان"}</span>
                  {link.isActive ? (
                    <Badge variant="success">فعال</Badge>
                  ) : (
                    <Badge>غیرفعال</Badge>
                  )}
                  <span className="text-xs text-muted">
                    ساخته‌شده در {formatDate(link.createdAt)} · {formatNumber(link._count.orders)} سفارش
                  </span>
                </div>
                <p className="text-sm text-muted">{link.products.map((p) => p.name).join("، ")}</p>
                <LinkFunnelStats counts={funnelByLink.get(link.id) ?? noActivity} />
                <div className="flex flex-wrap items-center gap-2">
                  <code dir="ltr" className="rounded bg-raised-2 px-2 py-1 text-xs text-ink-soft">
                    /buy/{link.token}
                  </code>
                  <CopyLinkButton path={`/buy/${link.token}`} />
                  <form action={setPurchaseLinkActiveAction.bind(null, link.id)}>
                    <input type="hidden" name="active" value={link.isActive ? "false" : "true"} />
                    <Button type="submit" variant="ghost" size="sm">
                      {link.isActive ? "غیرفعال کردن" : "فعال کردن"}
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {links.length > 0 && <p className="text-xs text-muted">{FUNNEL_NOTE}</p>}
    </div>
  );
}
