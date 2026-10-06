import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/catalog/product-form";
import { requireMember } from "@/server/auth";
import { updateProductAction } from "@/server/catalog/actions";
import { getProduct, listCategories } from "@/server/catalog/queries";
import { countLinesWithoutCost } from "@/server/finance/costs";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "ویرایش محصول | غلتک" };

export default async function EditProductPage(
  props: PageProps<"/products/[id]/edit">,
) {
  const seller = await requireMember();
  // The cost price is the owner's (finance): for an operator it is not even
  // sent to the form, which is a client component.
  const isOwner = seller.role === "OWNER";
  const { id } = await props.params;

  // Scoped by sellerId: another seller's product id behaves like a missing one.
  const [product, categories, linesWithoutCost] = await Promise.all([
    getProduct(seller.id, id),
    listCategories(seller.id),
    isOwner ? countLinesWithoutCost(seller.id, id) : 0,
  ]);
  if (!product) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader back={{ href: "/products", label: "محصولات" }} title="ویرایش محصول" description={product.name} />
      <ProductForm
        action={updateProductAction.bind(null, product.id)}
        categories={categories}
        submitLabel="ذخیرهٔ تغییرات"
        inventoryHref={`/inventory?product=${product.id}`}
        cost={isOwner ? { initial: product.costPrice, pastSalesWithoutCost: linesWithoutCost } : undefined}
        initial={{
          name: product.name,
          price: product.price,
          category: product.category,
          isActive: product.isActive,
          lowStockThreshold: product.lowStockThreshold,
          imageUrl: product.imageUrl,
          variants: product.variants.map((v) => ({
            id: v.id,
            color: v.color,
            size: v.size,
            sku: v.sku,
            stock: v.stock,
          })),
        }}
      />
    </div>
  );
}
