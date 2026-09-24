"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSeller } from "@/server/auth";
import { deleteProductImage, saveProductImage } from "./image-storage";
import {
  parseProductForm,
  type FieldErrors,
  type ProductInput,
} from "./product-form";

export type ProductFormState =
  | { errors?: FieldErrors; message?: string }
  | undefined;

const GENERIC_ERROR = "خطای غیرمنتظره‌ای رخ داد. دوباره تلاش کنید.";
const SKU_TAKEN = "این کد کالا قبلاً برای تنوع دیگری استفاده شده است.";

/** SKUs must be unique per seller. Reports which submitted rows collide. */
async function findSkuConflicts(
  sellerId: string,
  variants: ProductInput["variants"],
  ownVariantIds: string[],
): Promise<FieldErrors> {
  const skus = variants.flatMap((v) => (v.sku ? [v.sku] : []));
  if (skus.length === 0) return {};

  const taken = await prisma.productVariant.findMany({
    where: { sellerId, sku: { in: skus }, id: { notIn: ownVariantIds } },
    select: { sku: true },
  });
  const takenSet = new Set(taken.map((t) => t.sku));

  const errors: FieldErrors = {};
  variants.forEach((v, i) => {
    if (v.sku && takenSet.has(v.sku)) errors[`variants.${i}.sku`] = [SKU_TAKEN];
  });
  return errors;
}

function uploadedFile(formData: FormData): File | null {
  const value = formData.get("image");
  return value instanceof File && value.size > 0 ? value : null;
}

function dbErrorState(err: unknown): ProductFormState {
  if ((err as { code?: string }).code === "P2002") {
    return { errors: { variants: [SKU_TAKEN] } };
  }
  console.error("product save failed", err);
  return { message: GENERIC_ERROR };
}

export async function createProductAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const seller = await requireSeller();

  const parsed = parseProductForm(formData);
  if (!parsed.success) return { errors: parsed.errors };
  const data = parsed.data;

  const skuErrors = await findSkuConflicts(seller.id, data.variants, []);
  if (Object.keys(skuErrors).length > 0) return { errors: skuErrors };

  let imageUrl: string | null = null;
  const file = uploadedFile(formData);
  if (file) {
    const saved = await saveProductImage(file);
    if (!saved.ok) return { errors: { image: [saved.error] } };
    imageUrl = saved.url;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          sellerId: seller.id,
          name: data.name,
          price: data.price,
          category: data.category,
          isActive: data.isActive,
          lowStockThreshold: data.lowStockThreshold,
          imageUrl,
        },
        select: { id: true },
      });

      const variants = await tx.productVariant.createManyAndReturn({
        data: data.variants.map((v) => ({
          sellerId: seller.id,
          productId: product.id,
          color: v.color,
          size: v.size,
          sku: v.sku,
          stock: v.stock,
        })),
        select: { id: true, stock: true },
      });

      const movements = variants
        .filter((v) => v.stock > 0)
        .map((v) => ({ variantId: v.id, delta: v.stock, reason: "INITIAL" as const }));
      if (movements.length > 0) await tx.stockMovement.createMany({ data: movements });
    });
  } catch (err) {
    await deleteProductImage(imageUrl);
    return dbErrorState(err);
  }

  revalidatePath("/products");
  redirect("/products");
}

/**
 * Stock of EXISTING variants is not edited here: stock changes go through the
 * inventory page (task A2) / adjustStock so every change is logged. New
 * variants added on this form take an initial stock.
 */
export async function updateProductAction(
  productId: string,
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const seller = await requireSeller();

  const existing = await prisma.product.findFirst({
    where: { id: productId, sellerId: seller.id },
    select: {
      imageUrl: true,
      variants: {
        select: {
          id: true,
          color: true,
          size: true,
          _count: { select: { orderItems: true } },
        },
      },
    },
  });
  if (!existing) notFound();

  const parsed = parseProductForm(formData);
  if (!parsed.success) return { errors: parsed.errors };
  const data = parsed.data;

  const ownIds = existing.variants.map((v) => v.id);
  const keptIds = data.variants.flatMap((v) => (v.id ? [v.id] : []));
  if (keptIds.some((id) => !ownIds.includes(id))) {
    return { message: "اطلاعات تنوع‌ها نامعتبر است. صفحه را دوباره باز کنید." };
  }

  const removed = existing.variants.filter((v) => !keptIds.includes(v.id));
  const blocked = removed.filter((v) => v._count.orderItems > 0);
  if (blocked.length > 0) {
    const labels = blocked
      .map((v) => [v.color, v.size].filter(Boolean).join(" / ") || "بدون رنگ و سایز")
      .join("، ");
    return {
      message: `این تنوع‌ها در سفارش‌ها استفاده شده‌اند و قابل حذف نیستند: ${labels}`,
    };
  }

  const skuErrors = await findSkuConflicts(seller.id, data.variants, ownIds);
  if (Object.keys(skuErrors).length > 0) return { errors: skuErrors };

  const removeImage = formData.get("removeImage") === "on";
  let newImageUrl: string | null = null;
  const file = uploadedFile(formData);
  if (file) {
    const saved = await saveProductImage(file);
    if (!saved.ok) return { errors: { image: [saved.error] } };
    newImageUrl = saved.url;
  }
  const imageUrl = newImageUrl ?? (removeImage ? null : existing.imageUrl);

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.product.updateMany({
        where: { id: productId, sellerId: seller.id },
        data: {
          name: data.name,
          price: data.price,
          category: data.category,
          isActive: data.isActive,
          lowStockThreshold: data.lowStockThreshold,
          imageUrl,
        },
      });
      if (updated.count !== 1) throw new Error("product not found");

      // Delete first so a new variant may reuse a removed variant's SKU.
      if (removed.length > 0) {
        await tx.productVariant.deleteMany({
          where: { id: { in: removed.map((v) => v.id) }, productId, sellerId: seller.id },
        });
      }

      for (const v of data.variants) {
        if (!v.id) continue;
        await tx.productVariant.updateMany({
          where: { id: v.id, productId, sellerId: seller.id },
          data: { color: v.color, size: v.size, sku: v.sku },
        });
      }

      const added = data.variants.filter((v) => !v.id);
      if (added.length > 0) {
        const created = await tx.productVariant.createManyAndReturn({
          data: added.map((v) => ({
            sellerId: seller.id,
            productId,
            color: v.color,
            size: v.size,
            sku: v.sku,
            stock: v.stock,
          })),
          select: { id: true, stock: true },
        });
        const movements = created
          .filter((v) => v.stock > 0)
          .map((v) => ({ variantId: v.id, delta: v.stock, reason: "INITIAL" as const }));
        if (movements.length > 0) await tx.stockMovement.createMany({ data: movements });
      }
    });
  } catch (err) {
    await deleteProductImage(newImageUrl);
    return dbErrorState(err);
  }

  if (existing.imageUrl && existing.imageUrl !== imageUrl) {
    await deleteProductImage(existing.imageUrl);
  }

  revalidatePath("/products");
  redirect("/products");
}
