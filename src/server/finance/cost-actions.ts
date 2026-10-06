"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/server/auth";
import { MAX_PRICE, parseWholeNumber } from "@/server/catalog/product-form";
import { fillMissingCosts } from "./costs";

// The cost field on «سود محصولات» (spec §6.4): saves a product's cost price
// and, if asked, gives it to the past sales that had none. The owner's only.

export type CostFormState = { ok?: boolean; error?: string } | undefined;

export async function setProductCostAction(productId: string, _prev: CostFormState, formData: FormData): Promise<CostFormState> {
  const owner = await requireOwner();
  const cost = parseWholeNumber(formData.get("cost"));
  if (cost === null) return { error: "قیمت خرید را به تومان و با عدد وارد کنید." };
  if (cost > MAX_PRICE) return { error: "قیمت خرید بیش از حد مجاز است." };
  const applyToPast = formData.get("applyToPast") === "on";

  const saved = await prisma.$transaction(async (tx) => {
    const { count } = await tx.product.updateMany({ where: { id: productId, sellerId: owner.id }, data: { costPrice: cost } });
    if (count === 0) return false;
    if (applyToPast) await fillMissingCosts(tx, owner.id, productId, cost);
    return true;
  });
  if (!saved) return { error: "این محصول پیدا نشد." };
  revalidatePath("/finance", "layout");
  revalidatePath("/products", "layout");
  return { ok: true };
}
