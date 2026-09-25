import "server-only";
import { decryptSecret, encryptSecret, lastFour } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { formatCardNumber, formatSheba, type CardDetailsInput } from "./card-details";

// The seller's card-to-card details, stored ENCRYPTED (docs/phase2/README.md,
// ownership rule 1). Three ways out, each showing no more than it must:
// - settings: only the last four digits, never the full numbers
// - the customer's own order page: the full card number, to pay into
// - nothing else (no lists, logs, errors or other public pages)

export type CardDetailsForSettings = {
  cardMasked: string | null;
  cardHolder: string | null;
  shebaMasked: string | null;
};

/** What the «پرداخت» tab shows after saving: masked only. */
export async function getCardDetailsForSettings(sellerId: string): Promise<CardDetailsForSettings> {
  const row = await prisma.seller.findUnique({
    where: { id: sellerId },
    select: { cardNumberEncrypted: true, cardHolder: true, shebaEncrypted: true },
  });
  return {
    cardMasked: maskOrNull(row?.cardNumberEncrypted),
    cardHolder: row?.cardHolder ?? null,
    shebaMasked: maskOrNull(row?.shebaEncrypted),
  };
}

function maskOrNull(stored: string | null | undefined): string | null {
  if (!stored) return null;
  try {
    return lastFour(decryptSecret(stored));
  } catch {
    // Wrong or rotated SECRETS_KEY: say it's saved, show nothing of it.
    return "••••";
  }
}

export type CardDetailsForCustomer = {
  cardNumber: string; // "6037 9912 3456 7893"
  cardHolder: string;
  sheba: string | null; // "IR82 0540 ..."
};

/**
 * The full card details for the payment instructions on a customer's OWN
 * order page (/buy/order/[token]), or null when the seller hasn't set them.
 * The seller comes from the order, never from anything the visitor sends.
 */
export async function getCardDetailsForCustomer(sellerId: string): Promise<CardDetailsForCustomer | null> {
  const row = await prisma.seller.findUnique({
    where: { id: sellerId },
    select: { cardNumberEncrypted: true, cardHolder: true, shebaEncrypted: true },
  });
  if (!row?.cardNumberEncrypted || !row.cardHolder) return null;
  try {
    return {
      cardNumber: formatCardNumber(decryptSecret(row.cardNumberEncrypted)),
      cardHolder: row.cardHolder,
      sheba: row.shebaEncrypted ? formatSheba(decryptSecret(row.shebaEncrypted)) : null,
    };
  } catch {
    // Never let a key problem (or the secret itself) reach the customer or the logs.
    console.error("card details could not be decrypted for a seller; check SECRETS_KEY");
    return null;
  }
}

export async function hasSavedCard(sellerId: string): Promise<boolean> {
  const row = await prisma.seller.findUnique({
    where: { id: sellerId },
    select: { cardNumberEncrypted: true },
  });
  return Boolean(row?.cardNumberEncrypted);
}

/** Saves the parsed form. Fields left undefined keep their stored value. */
export async function saveCardDetails(sellerId: string, input: CardDetailsInput): Promise<void> {
  await prisma.seller.update({
    where: { id: sellerId },
    data: {
      cardHolder: input.cardHolder,
      ...(input.cardNumber !== undefined
        ? { cardNumberEncrypted: input.cardNumber === null ? null : encryptSecret(input.cardNumber) }
        : {}),
      ...(input.sheba !== undefined
        ? { shebaEncrypted: input.sheba === null ? null : encryptSecret(input.sheba) }
        : {}),
    },
  });
}
