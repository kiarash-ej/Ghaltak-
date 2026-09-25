import { describe, expect, it } from "vitest";
import { cleanHandle, parseStoreProfileForm } from "./profile-form";

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

describe("cleanHandle", () => {
  it("accepts what sellers type or paste", () => {
    expect(cleanHandle("@nemoone.shop", "instagram")).toBe("nemoone.shop");
    expect(cleanHandle("  nemoone.shop ", "instagram")).toBe("nemoone.shop");
    expect(cleanHandle("https://www.instagram.com/nemoone.shop/?igsh=abc123", "instagram")).toBe("nemoone.shop");
    expect(cleanHandle("instagram.com/nemoone.shop", "instagram")).toBe("nemoone.shop");
    expect(cleanHandle("https://t.me/nemoone_shop", "telegram")).toBe("nemoone_shop");
    expect(cleanHandle("@nemoone_shop", "telegram")).toBe("nemoone_shop");
  });

  it("does not take a link to the other platform as a handle", () => {
    expect(cleanHandle("https://t.me/shop_one", "instagram")).toBe("https://t.me/shop_one");
  });
});

describe("parseStoreProfileForm", () => {
  it("normalizes a full form", () => {
    const result = parseStoreProfileForm(
      form({
        name: "  پوشاک نمونه  ",
        contactPhone: "۰۹۱۲ ۱۲۳ ۴۵۶۷",
        instagram: "@nemoone.shop",
        telegram: "https://t.me/nemoone_shop",
      }),
    );
    expect(result).toEqual({
      success: true,
      data: {
        name: "پوشاک نمونه",
        contactPhone: "09121234567",
        instagram: "nemoone.shop",
        telegram: "nemoone_shop",
      },
    });
  });

  it("stores empty optional fields as null", () => {
    const result = parseStoreProfileForm(form({ name: "فروشگاه", contactPhone: " ", instagram: "", telegram: "@" }));
    expect(result).toEqual({
      success: true,
      data: { name: "فروشگاه", contactPhone: null, instagram: null, telegram: null },
    });
  });

  it("rejects a missing or long name", () => {
    expect(parseStoreProfileForm(form({ name: "   " }))).toMatchObject({ success: false, errors: { name: [expect.any(String)] } });
    expect(parseStoreProfileForm(form({ name: "ا".repeat(61) }))).toMatchObject({ success: false });
  });

  it("rejects an invalid phone and handles, one message per field", () => {
    const result = parseStoreProfileForm(
      form({ name: "فروشگاه", contactPhone: "021-1234", instagram: "shop..one", telegram: "1shop" }),
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(Object.keys(result.errors).sort()).toEqual(["contactPhone", "instagram", "telegram"]);
  });

  it.each([
    ["instagram", "shop name"],
    ["instagram", ".shop"],
    ["instagram", "shop."],
    ["instagram", "a".repeat(31)],
    ["instagram", "<script>"],
    ["telegram", "shop"], // too short
    ["telegram", "shop.one"], // no dots on Telegram
    ["telegram", "a".repeat(33)],
  ])("rejects %s handle %j", (field, value) => {
    expect(parseStoreProfileForm(form({ name: "فروشگاه", [field]: value })).success).toBe(false);
  });
});
