"use server";

import { revalidatePath } from "next/cache";
import { requireSeller } from "@/server/auth";
import { parseCardDetailsForm } from "./card-details";
import {
  getCardDetailsForSettings,
  hasSavedCard,
  saveCardDetails,
  type CardDetailsForSettings,
} from "./card-store";

export type CardDetailsFormState =
  | { errors?: Record<string, string[]>; message?: string; saved?: CardDetailsForSettings; savedAt?: number }
  | undefined;

/** Saves the seller's card-to-card details («پرداخت» settings tab). */
export async function saveCardDetailsAction(
  _prev: CardDetailsFormState,
  formData: FormData,
): Promise<CardDetailsFormState> {
  // TODO(A10): requireMember("OWNER") once team members exist; today every seller is its owner.
  const seller = await requireSeller();

  const parsed = parseCardDetailsForm(formData, { hasCard: await hasSavedCard(seller.id) });
  if (!parsed.success) return { errors: parsed.errors };

  try {
    await saveCardDetails(seller.id, parsed.data);
  } catch (err) {
    // Never log the error object: it could carry the card number.
    console.error("card details save failed:", (err as Error).name);
    return { message: "ذخیره انجام نشد. دوباره تلاش کنید." };
  }

  revalidatePath("/settings/payments");
  return { saved: await getCardDetailsForSettings(seller.id), savedAt: Date.now() };
}
