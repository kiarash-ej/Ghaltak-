import type { Metadata } from "next";
import { ProductForm } from "@/components/catalog/product-form";
import { requireSeller } from "@/server/auth";
import { createProductAction } from "@/server/catalog/actions";
import { listCategories } from "@/server/catalog/queries";

export const metadata: Metadata = { title: "محصول جدید | غلتک" };

export default async function NewProductPage() {
  const seller = await requireSeller();
  const categories = await listCategories(seller.id);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">محصول جدید</h1>
      <ProductForm
        action={createProductAction}
        categories={categories}
        submitLabel="ثبت محصول"
      />
    </div>
  );
}
