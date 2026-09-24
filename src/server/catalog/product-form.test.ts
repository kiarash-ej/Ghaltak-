import { describe, expect, it } from "vitest";
import { parseProductForm, parseWholeNumber } from "./product-form";
import { sniffImageType } from "./image-type";
import { getStockStatus } from "./stock-status";

type VariantRow = { id?: string; color?: string; size?: string; sku?: string; stock?: string };

function form(
  fields: Record<string, string>,
  variants: VariantRow[] = [{ color: "مشکی", size: "M", stock: "5" }],
): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  for (const v of variants) {
    fd.append("variantId", v.id ?? "");
    fd.append("variantColor", v.color ?? "");
    fd.append("variantSize", v.size ?? "");
    fd.append("variantSku", v.sku ?? "");
    fd.append("variantStock", v.stock ?? "");
  }
  return fd;
}

const valid = { name: "مانتو کتان", price: "1500000", isActive: "on" };

describe("parseWholeNumber", () => {
  it.each([
    ["1250000", 1250000],
    ["1,250,000", 1250000],
    ["۱٬۲۵۰٬۰۰۰", 1250000],
    ["۱۲۵۰۰۰۰", 1250000],
    [" 42 ", 42],
    ["0", 0],
  ])("parses %s", (input, expected) => {
    expect(parseWholeNumber(input)).toBe(expected);
  });

  it.each(["", "abc", "12.5", "-3", "1e5", "12345678901"])("rejects %s", (input) => {
    expect(parseWholeNumber(input)).toBeNull();
  });

  it("rejects non-strings", () => {
    expect(parseWholeNumber(null)).toBeNull();
    expect(parseWholeNumber(new File([""], "x.txt"))).toBeNull();
  });
});

describe("parseProductForm", () => {
  it("accepts a valid product and normalizes values", () => {
    const result = parseProductForm(
      form({ ...valid, price: "۱٬۵۰۰٬۰۰۰", category: "  پوشاک  " }, [
        { color: "مشکی", size: "M", sku: "MN-1", stock: "۵" },
        { color: "", size: "", stock: "0" },
      ]),
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.price).toBe(1500000);
    expect(result.data.category).toBe("پوشاک");
    expect(result.data.isActive).toBe(true);
    expect(result.data.lowStockThreshold).toBe(3);
    expect(result.data.variants[0]).toMatchObject({ sku: "MN-1", stock: 5, id: null });
    expect(result.data.variants[1]).toMatchObject({ color: null, size: null });
  });

  it("treats an unchecked box as inactive", () => {
    const result = parseProductForm(form({ name: "x", price: "1000" }));
    expect(result.success && result.data.isActive).toBe(false);
  });

  it("reports a missing name and a bad price", () => {
    const result = parseProductForm(form({ name: "  ", price: "abc" }));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.name).toBeDefined();
    expect(result.errors.price).toBeDefined();
  });

  it("rejects a zero price and a price above the Int range", () => {
    for (const price of ["0", "2000000001"]) {
      const result = parseProductForm(form({ ...valid, price }));
      expect(result.success).toBe(false);
    }
  });

  it("requires at least one variant", () => {
    const result = parseProductForm(form(valid, []));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.variants).toBeDefined();
  });

  it("flags duplicate color+size combinations on the second row", () => {
    const result = parseProductForm(
      form(valid, [
        { color: "مشکی", size: "M", stock: "1" },
        { color: "مشکی", size: "m", stock: "2" },
      ]),
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors["variants.1.color"]).toBeDefined();
  });

  it("flags duplicate SKUs inside the form, ignoring case", () => {
    const result = parseProductForm(
      form(valid, [
        { color: "a", sku: "ABC", stock: "1" },
        { color: "b", sku: "abc", stock: "1" },
      ]),
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors["variants.1.sku"]).toBeDefined();
  });

  it("rejects a non-numeric stock on a new variant", () => {
    const result = parseProductForm(form(valid, [{ color: "a", stock: "many" }]));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors["variants.0.stock"]).toBeDefined();
  });

  it("keeps existing variant ids", () => {
    const result = parseProductForm(form(valid, [{ id: "var_1", color: "a" }]));
    expect(result.success && result.data.variants[0].id).toBe("var_1");
  });
});

describe("sniffImageType", () => {
  it("detects jpeg, png and webp by their signatures", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]))).toBe("jpg");
    expect(
      sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])),
    ).toBe("png");
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);
    expect(sniffImageType(webp)).toBe("webp");
  });

  it("rejects other content, including HTML and SVG renamed to .jpg", () => {
    const enc = new TextEncoder();
    expect(sniffImageType(enc.encode("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffImageType(enc.encode("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(sniffImageType(new Uint8Array([]))).toBeNull();
  });
});

describe("getStockStatus", () => {
  it("is out of stock when every variant is empty or there are none", () => {
    expect(getStockStatus([0, 0], 3)).toBe("OUT_OF_STOCK");
    expect(getStockStatus([], 3)).toBe("OUT_OF_STOCK");
  });

  it("is low when any variant is at or below the threshold", () => {
    expect(getStockStatus([10, 3], 3)).toBe("LOW");
    expect(getStockStatus([0, 8], 3)).toBe("LOW");
  });

  it("is ok when all variants are above the threshold", () => {
    expect(getStockStatus([4, 20], 3)).toBe("OK");
  });
});
