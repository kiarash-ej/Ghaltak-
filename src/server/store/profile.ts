import "server-only";
import { prisma } from "@/lib/prisma";

// Contract for Track B (docs/phase2/README.md, cross-track contracts): what a
// store shows about itself on the public /buy pages.

export type PublicStoreProfile = {
  name: string;
  /** "/uploads/logos/<uuid>.<ext>", or null without a logo. */
  logoUrl: string | null;
  /** The contact number the seller entered, "09xxxxxxxxx". */
  contactPhone: string | null;
  /** Handles without "@". */
  instagram: string | null;
  telegram: string | null;
};

/**
 * The public face of a store, or null if the seller doesn't exist.
 *
 * Never returns the login mobile or anything else private: the select below is
 * the whole list, and it is exactly what the seller chose to publish in
 * /settings. Their login mobile appears only if they typed it as contactPhone.
 */
export async function getPublicStoreProfile(
  sellerId: string,
): Promise<PublicStoreProfile | null> {
  return prisma.seller.findUnique({
    where: { id: sellerId },
    select: { name: true, logoUrl: true, contactPhone: true, instagram: true, telegram: true },
  });
}
