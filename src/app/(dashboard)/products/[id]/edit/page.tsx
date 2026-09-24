import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/catalog/product-form";
import { requireSeller } from "@/server/auth";
import { updateProductAction } from "@/server/catalog/actions";
import { getProduct, listCategories } from "@/server/catalog/queries";

export const metadata: Metadata = { title: "ویرایش محصول | غلتک" };

export default async function EditProductPage(
  props: PageProps<"/products/[id]/edit">,
) {
  const seller = await requireSeller();
  const { id } = await props.params;

  // Scoped by sellerId: another seller's product id behaves like a missing one.
  const [product, categories] = await Promise.all([
    getProduct(seller.id, id),
    listCategories(seller.id),
  ]);
  if (!product) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">ویرایش محصول</h1>
      <ProductForm
        action={updateProductAction.bind(null, product.id)}
        categories={categories}
        submitLabel="ذخیرهٔ تغییرات"
        inventoryHref={`/inventory?product=${product.id}`}
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
