import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hasTestDatabase } from "@/test/setup";
import { prisma } from "@/lib/prisma";
import {
  getCardDetailsForCustomer,
  getCardDetailsForSettings,
  hasSavedCard,
  saveCardDetails,
} from "./card-store";

// The seller's card-to-card details against a real Postgres (TEST_DATABASE_URL).

const CARD = "6037991234567893";
const OTHER_CARD = "6274129876543219";
const SHEBA = "IR820540102680020817909002";

describe.skipIf(!hasTestDatabase)("card details (database)", () => {
  const runId = String(Date.now()).slice(-7);
  const savedKey = process.env.SECRETS_KEY;
  let sellerId = "";
  let otherSellerId = "";

  beforeAll(async () => {
    process.env.SECRETS_KEY = randomBytes(32).toString("base64");
    sellerId = (await prisma.seller.create({ data: { name: "card test", mobile: `0996${runId}` } })).id;
    otherSellerId = (await prisma.seller.create({ data: { name: "other", mobile: `0997${runId}` } })).id;
  });

  afterAll(async () => {
    process.env.SECRETS_KEY = savedKey;
    if (sellerId) await prisma.seller.deleteMany({ where: { id: { in: [sellerId, otherSellerId] } } });
    await prisma.$disconnect();
  });

  it("stores the card number and Sheba encrypted, never in plain text", async () => {
    await saveCardDetails(sellerId, { cardNumber: CARD, cardHolder: "سارا احمدی", sheba: SHEBA });
    const row = await prisma.seller.findUniqueOrThrow({ where: { id: sellerId } });
    expect(row.cardNumberEncrypted).toMatch(/^v1\./);
    expect(row.cardNumberEncrypted).not.toContain(CARD);
    expect(row.cardNumberEncrypted).not.toContain(CARD.slice(-4));
    expect(row.shebaEncrypted).toMatch(/^v1\./);
    expect(row.shebaEncrypted).not.toContain(SHEBA.slice(2));
  });

  it("shows settings only the last four digits", async () => {
    const view = await getCardDetailsForSettings(sellerId);
    expect(view).toEqual({ cardMasked: "•••• 7893", cardHolder: "سارا احمدی", shebaMasked: "•••• 9002" });
    expect(JSON.stringify(view)).not.toContain(CARD);
  });

  it("gives the customer's order page the full, formatted details", async () => {
    expect(await getCardDetailsForCustomer(sellerId)).toEqual({
      cardNumber: "6037 9912 3456 7893",
      cardHolder: "سارا احمدی",
      sheba: "IR82 0540 1026 8002 0817 9090 02",
    });
  });

  it("keeps stored values for fields left undefined, and removes them with null", async () => {
    await saveCardDetails(sellerId, { cardHolder: "سارا احمدی" });
    expect((await getCardDetailsForSettings(sellerId)).cardMasked).toBe("•••• 7893");

    await saveCardDetails(sellerId, { cardNumber: OTHER_CARD, cardHolder: "سارا احمدی", sheba: null });
    const view = await getCardDetailsForSettings(sellerId);
    expect(view.cardMasked).toBe("•••• 3219");
    expect(view.shebaMasked).toBeNull();
  });

  it("never shows one seller's card for another", async () => {
    expect(await hasSavedCard(otherSellerId)).toBe(false);
    expect(await getCardDetailsForCustomer(otherSellerId)).toBeNull();
    expect(await getCardDetailsForSettings(otherSellerId)).toEqual({
      cardMasked: null,
      cardHolder: null,
      shebaMasked: null,
    });
  });

  it("shows nothing to the customer if the key changed, instead of failing the page", async () => {
    const key = process.env.SECRETS_KEY;
    process.env.SECRETS_KEY = randomBytes(32).toString("base64");
    try {
      expect(await getCardDetailsForCustomer(sellerId)).toBeNull();
      expect((await getCardDetailsForSettings(sellerId)).cardMasked).toBe("••••");
    } finally {
      process.env.SECRETS_KEY = key;
    }
  });
});
