"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSeller } from "@/server/auth";
import { parseCustomerForm, type CustomerInput, type FieldErrors } from "./customer-form";
import { isCustomerTag } from "./stats";

export type CustomerFormState =
  | { ok: true; saved: CustomerInput }
  | { ok: false; errors?: FieldErrors; message?: string }
  | undefined;

const PHONE_TAKEN = "این شماره برای مشتری دیگری ثبت شده است.";

function refreshCustomerPages() {
  revalidatePath("/customers");
  revalidatePath("/customers/[id]", "page");
  // Track B's order pages show the customer's name and phone.
  revalidatePath("/orders");
  revalidatePath("/orders/[id]", "page");
}

export async function updateCustomerAction(
  customerId: string,
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const seller = await requireSeller();

  const parsed = parseCustomerForm(formData);
  if (!parsed.success) return { ok: false, errors: parsed.errors };
  const data = parsed.data;

  // Phone is unique per seller (it is how purchase-link orders find a customer).
  const taken = await prisma.customer.findFirst({
    where: { sellerId: seller.id, phone: data.phone, id: { not: customerId } },
    select: { id: true },
  });
  if (taken) return { ok: false, errors: { phone: [PHONE_TAKEN] } };

  try {
    const { count } = await prisma.customer.updateMany({
      where: { id: customerId, sellerId: seller.id },
      data,
    });
    if (count !== 1) return { ok: false, message: "مشتری پیدا نشد." };
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return { ok: false, errors: { phone: [PHONE_TAKEN] } };
    }
    console.error("customer update failed", err);
    return { ok: false, message: "خطای غیرمنتظره‌ای رخ داد. دوباره تلاش کنید." };
  }

  refreshCustomerPages();
  return { ok: true, saved: data };
}

/** Sets only the tag, e.g. when the seller accepts the suggested one. */
export async function setCustomerTagAction(customerId: string, formData: FormData) {
  const seller = await requireSeller();
  const tag = formData.get("tag");
  if (!isCustomerTag(tag)) return;

  await prisma.customer.updateMany({
    where: { id: customerId, sellerId: seller.id },
    data: { tag },
  });
  refreshCustomerPages();
}
