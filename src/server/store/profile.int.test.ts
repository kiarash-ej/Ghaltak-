import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hasTestDatabase } from "@/test/setup";
import { getPublicStoreProfile } from "./profile";

// Runs against a real Postgres (TEST_DATABASE_URL). See docs/phase1/README.md.
describe.skipIf(!hasTestDatabase)("getPublicStoreProfile (database)", () => {
  const mobile = `0995${String(Date.now()).slice(-7)}`;

  afterAll(async () => {
    await prisma.seller.deleteMany({ where: { mobile } });
    await prisma.$disconnect();
  });

  it("returns exactly the five public fields, never the login mobile or card details", async () => {
    const seller = await prisma.seller.create({
      data: {
        mobile,
        name: "فروشگاه آزمایشی",
        instagram: "test.shop",
        cardHolder: "نام صاحب کارت",
        cardNumberEncrypted: "v1.secret",
        shebaEncrypted: "v1.secret",
      },
    });

    const profile = await getPublicStoreProfile(seller.id);

    expect(profile).toEqual({
      name: "فروشگاه آزمایشی",
      logoUrl: null,
      contactPhone: null,
      instagram: "test.shop",
      telegram: null,
    });
    expect(JSON.stringify(profile)).not.toContain(mobile);
  });

  it("returns null for an unknown seller", async () => {
    expect(await getPublicStoreProfile("no-such-seller")).toBeNull();
  });
});
