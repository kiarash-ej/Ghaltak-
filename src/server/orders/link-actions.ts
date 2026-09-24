"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { prisma } from "@/lib/prisma";
import { requireSeller } from "@/server/auth";
import type { FieldErrors } from "./order-form";

export type PurchaseLinkFormState =
  | { errors?: FieldErrors; message?: string; createdToken?: string }
  | undefined;

const MAX_PRODUCTS_PER_LINK = 50;

const linkSchema = z.object({
  title: z
    .string()
    .trim()
    .max(80, { error: "عنوان حداکثر ۸۰ نویسه باشد." })
    .transform((v) => (v === "" ? null : v)),
  productIds: z
    .array(z.string().min(1).max(64))
    .min(1, { error: "حداقل یک محصول انتخاب کنید." })
    .max(MAX_PRODUCTS_PER_LINK, { error: `حداکثر ${MAX_PRODUCTS_PER_LINK} محصول در هر لینک.` }),
});

export async function createPurchaseLinkAction(
  _prev: PurchaseLinkFormState,
  formData: FormData,
): Promise<PurchaseLinkFormState> {
  const seller = await requireSeller();

  const parsed = linkSchema.safeParse({
    title: formData.get("title") ?? "",
    productIds: [...new Set(formData.getAll("productId").filter((v) => typeof v === "string"))],
  });
  if (!parsed.success) {
    const errors: FieldErrors = {};
    for (const issue of parsed.error.issues) (errors[String(issue.path[0])] ??= []).push(issue.message);
    return { errors };
  }

  // Only this seller's active products can be attached.
  const products = await prisma.product.findMany({
    where: { id: { in: parsed.data.productIds }, sellerId: seller.id, isActive: true },
    select: { id: true },
  });
  if (products.length !== parsed.data.productIds.length) {
    return { errors: { productIds: ["یکی از محصولات انتخاب‌شده پیدا نشد یا غیرفعال است."] } };
  }

  const token = randomBytes(18).toString("base64url");
  await prisma.purchaseLink.create({
    data: {
      sellerId: seller.id,
      token,
      title: parsed.data.title,
      products: { connect: products.map((p) => ({ id: p.id })) },
    },
  });

  revalidatePath("/orders/links");
  return { createdToken: token };
}

export async function setPurchaseLinkActiveAction(linkId: string, formData: FormData) {
  const seller = await requireSeller();
  const isActive = formData.get("active") === "true";

  await prisma.purchaseLink.updateMany({
    where: { id: linkId, sellerId: seller.id },
    data: { isActive },
  });
  revalidatePath("/orders/links");
}
