import { describe, expect, it } from "vitest";
import { parseAdjustForm, previewStock } from "./adjust-form";
import { getVariantStockStatus } from "./stock-status";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("parseAdjustForm", () => {
  it("turns add and remove into a signed delta", () => {
    expect(parseAdjustForm(form({ mode: "add", quantity: "۱۰" }))).toEqual({
      success: true,
      data: { kind: "delta", delta: 10, note: null },
    });
    expect(parseAdjustForm(form({ mode: "remove", quantity: "3", note: "  خراب شد  " }))).toEqual({
      success: true,
      data: { kind: "delta", delta: -3, note: "خراب شد" },
    });
  });

  it("returns target and expected stock for set", () => {
    expect(
      parseAdjustForm(form({ mode: "set", quantity: "0", expectedStock: "7" })),
    ).toEqual({
      success: true,
      data: { kind: "set", target: 0, expectedStock: 7, note: null },
    });
  });

  it("allows zero only for set", () => {
    expect(parseAdjustForm(form({ mode: "add", quantity: "0" })).success).toBe(false);
    expect(parseAdjustForm(form({ mode: "remove", quantity: "0" })).success).toBe(false);
  });

  it.each([
    [{ mode: "move", quantity: "1" }],
    [{ quantity: "1" }],
    [{ mode: "add", quantity: "" }],
    [{ mode: "add", quantity: "-2" }],
    [{ mode: "add", quantity: "1.5" }],
    [{ mode: "add", quantity: "1000001" }],
    [{ mode: "set", quantity: "4" }],
    [{ mode: "set", quantity: "4", expectedStock: "x" }],
    [{ mode: "add", quantity: "1", note: "ن".repeat(201) }],
  ])("rejects %j", (fields) => {
    const result = parseAdjustForm(form(fields));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.length).toBeGreaterThan(0);
  });
});

describe("previewStock", () => {
  it("computes the stock the change would produce", () => {
    expect(previewStock(5, "add", 3)).toBe(8);
    expect(previewStock(5, "remove", 3)).toBe(2);
    expect(previewStock(5, "remove", 8)).toBe(-3);
    expect(previewStock(5, "set", 12)).toBe(12);
    expect(previewStock(5, "add", null)).toBeNull();
  });
});

describe("getVariantStockStatus", () => {
  it("classifies a single variant against the product threshold", () => {
    expect(getVariantStockStatus(0, 3)).toBe("OUT_OF_STOCK");
    expect(getVariantStockStatus(3, 3)).toBe("LOW");
    expect(getVariantStockStatus(1, 0)).toBe("OK");
    expect(getVariantStockStatus(4, 3)).toBe("OK");
  });
});
