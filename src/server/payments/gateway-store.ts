import "server-only";
import { decryptSecret, encryptSecret, lastFour } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { createFakeGateway, fakeGatewayAllowed } from "./fake-gateway";
import type { GatewayFormInput } from "./gateway-form";
import type { PaymentGateway } from "./types";
import { createZarinpalClient } from "./zarinpal";

// The seller's OWN payment gateway (docs/phase2/README.md, decision 1):
// customers pay straight into the seller's account, never the platform's.
// Credentials are stored encrypted in SellerGateway.credentialsEncrypted and
// never shown in full after saving (rule 1).

type Credentials = { merchantId?: string; sandbox: boolean; fake?: boolean };

function readCredentials(stored: string): Credentials | null {
  try {
    return JSON.parse(decryptSecret(stored)) as Credentials;
  } catch {
    console.error("gateway credentials could not be decrypted; check SECRETS_KEY");
    return null;
  }
}

export type GatewayForSettings = {
  provider: "ZARINPAL";
  merchantMasked: string | null;
  sandbox: boolean;
  fake: boolean;
  isActive: boolean;
};

export async function getGatewayForSettings(sellerId: string): Promise<GatewayForSettings | null> {
  const row = await prisma.sellerGateway.findUnique({ where: { sellerId } });
  if (!row) return null;
  const creds = readCredentials(row.credentialsEncrypted);
  return {
    provider: "ZARINPAL",
    merchantMasked: creds?.merchantId ? lastFour(creds.merchantId) : creds ? null : "••••",
    sandbox: creds?.sandbox ?? false,
    fake: Boolean(creds?.fake),
    isActive: row.isActive,
  };
}

export async function hasSavedMerchant(sellerId: string): Promise<boolean> {
  const row = await prisma.sellerGateway.findUnique({ where: { sellerId } });
  return Boolean(row && readCredentials(row.credentialsEncrypted)?.merchantId);
}

/** Saves the settings form. An undefined merchantId keeps the saved one. */
export async function saveGateway(sellerId: string, input: GatewayFormInput): Promise<void> {
  const existing = await prisma.sellerGateway.findUnique({ where: { sellerId } });
  const previous = existing ? readCredentials(existing.credentialsEncrypted) : null;
  const creds: Credentials = {
    merchantId: input.merchantId ?? previous?.merchantId,
    sandbox: input.sandbox,
    ...(input.fake ? { fake: true } : {}),
  };
  const credentialsEncrypted = encryptSecret(JSON.stringify(creds));
  await prisma.sellerGateway.upsert({
    where: { sellerId },
    create: { sellerId, provider: "ZARINPAL", credentialsEncrypted, isActive: input.isActive },
    update: { provider: "ZARINPAL", credentialsEncrypted, isActive: input.isActive },
  });
}

/**
 * A client for the seller's gateway, or null when online payment is off or
 * unusable here. `activeOnly: false` is for the return from the gateway: a
 * payment already started must still be verified if the seller turned the
 * gateway off meanwhile.
 */
export async function gatewayForSeller(
  sellerId: string,
  opts: { activeOnly?: boolean } = {},
): Promise<PaymentGateway | null> {
  const row = await prisma.sellerGateway.findUnique({ where: { sellerId } });
  if (!row || ((opts.activeOnly ?? true) && !row.isActive)) return null;
  const creds = readCredentials(row.credentialsEncrypted);
  if (!creds) return null;
  if (creds.fake) return fakeGatewayAllowed() ? createFakeGateway() : null;
  if (!creds.merchantId) return null;
  return createZarinpalClient({ merchantId: creds.merchantId, sandbox: creds.sandbox });
}
