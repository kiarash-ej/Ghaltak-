import { describe, expect, it } from "vitest";
import { parseBuyForm } from "./buy-form";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

const buyer = {
  name: "  سارا احمدی ",
  phone: "۰۹۱۲۱۲۳۴۵۶۷",
  address: "تهران، خیابان آزادی، پلاک ۱۲",
};

describe("parseBuyForm", () => {
  it("parses a valid purchase and normalizes fields", () => {
    const result = parseBuyForm(
      form({
        ...buyer,
        "items.0.variantId": "v1",
        "items.0.quantity": "۲",
        "items.1.variantId": "v2",
        "items.1.quantity": "0",
      }),
    );
    expect(result).toEqual({
      success: true,
      data: {
        name: "سارا احمدی",
        phone: "09121234567",
        address: "تهران، خیابان آزادی، پلاک ۱۲",
        items: [{ variantId: "v1", quantity: 2 }],
      },
    });
  });

  it("skips products with zero or empty quantity", () => {
    const result = parseBuyForm(
      form({
        ...buyer,
        "items.0.variantId": "",
        "items.0.quantity": "",
        "items.1.variantId": "v2",
        "items.1.quantity": "1",
      }),
    );
    expect(result.success && result.data.items).toEqual([{ variantId: "v2", quantity: 1 }]);
  });

  it("requires at least one item", () => {
    const result = parseBuyForm(form({ ...buyer, "items.0.variantId": "v1", "items.0.quantity": "0" }));
    expect(!result.success && result.errors.items).toBeDefined();
  });

  it("asks for color/size when a quantity is set without a variant", () => {
    const result = parseBuyForm(form({ ...buyer, "items.0.variantId": "", "items.0.quantity": "1" }));
    expect(!result.success && result.errors["items.0.variantId"]).toBeDefined();
  });

  it("validates name, phone and address", () => {
    const result = parseBuyForm(
      form({ name: "", phone: "123", address: "کوتاه", "items.0.variantId": "v1", "items.0.quantity": "1" }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.name).toBeDefined();
      expect(result.errors.phone).toBeDefined();
      expect(result.errors.address).toBeDefined();
    }
  });

  it.each(["-1", "abc", "1.5", "5000"])("rejects quantity %s", (qty) => {
    const result = parseBuyForm(form({ ...buyer, "items.0.variantId": "v1", "items.0.quantity": qty }));
    expect(!result.success && result.errors["items.0.quantity"]).toBeDefined();
  });

  it("rejects variant ids with unexpected characters", () => {
    const result = parseBuyForm(
      form({ ...buyer, "items.0.variantId": "v1' OR 1=1", "items.0.quantity": "1" }),
    );
    expect(!result.success && result.errors["items.0.variantId"]).toBeDefined();
  });

  it("rejects a form with too many lines", () => {
    const fields: Record<string, string> = { ...buyer };
    for (let i = 0; i < 60; i++) {
      fields[`items.${i}.variantId`] = `v${i}`;
      fields[`items.${i}.quantity`] = "1";
    }
    const result = parseBuyForm(form(fields));
    expect(!result.success && result.errors.items).toBeDefined();
  });
});
