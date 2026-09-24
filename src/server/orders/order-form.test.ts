import { describe, expect, it } from "vitest";
import {
  MAX_QUANTITY,
  computeOrderTotal,
  mergeLines,
  parseOrderForm,
  parseQuantity,
} from "./order-form";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

const existingCustomer = { customerMode: "existing", customerId: "cust_1" };

describe("computeOrderTotal", () => {
  it("sums unit price times quantity", () => {
    expect(
      computeOrderTotal([
        { unitPrice: 250_000, quantity: 2 },
        { unitPrice: 90_000, quantity: 1 },
      ]),
    ).toBe(590_000);
  });

  it("is zero for no lines", () => {
    expect(computeOrderTotal([])).toBe(0);
  });
});

describe("mergeLines", () => {
  it("adds up repeated variants and keeps first-seen order", () => {
    expect(
      mergeLines([
        { variantId: "b", quantity: 1 },
        { variantId: "a", quantity: 2 },
        { variantId: "b", quantity: 3 },
      ]),
    ).toEqual([
      { variantId: "b", quantity: 4 },
      { variantId: "a", quantity: 2 },
    ]);
  });
});

describe("parseQuantity", () => {
  it.each([
    ["3", 3],
    ["۳", 3],
    [" 12 ", 12],
  ])("parses %s", (input, expected) => {
    expect(parseQuantity(input)).toBe(expected);
  });

  it.each(["", "abc", "-1", "1.5", "2e3"])("rejects %s", (input) => {
    expect(parseQuantity(input)).toBeNull();
  });
});

describe("parseOrderForm", () => {
  it("parses an order for an existing customer", () => {
    const result = parseOrderForm(
      form({
        ...existingCustomer,
        shippingAddress: "  تهران، خیابان آزادی  ",
        "items.0.variantId": "v1",
        "items.0.quantity": "۲",
        "items.1.variantId": "v2",
        "items.1.quantity": "1",
      }),
    );
    expect(result).toEqual({
      success: true,
      data: {
        customer: { kind: "existing", id: "cust_1" },
        shippingAddress: "تهران، خیابان آزادی",
        items: [
          { variantId: "v1", quantity: 2 },
          { variantId: "v2", quantity: 1 },
        ],
      },
    });
  });

  it("parses a new customer and normalizes the phone", () => {
    const result = parseOrderForm(
      form({
        customerMode: "new",
        customerName: " سارا ",
        customerPhone: "+98 912 123 4567",
        "items.0.variantId": "v1",
        "items.0.quantity": "1",
      }),
    );
    expect(result.success && result.data.customer).toEqual({
      kind: "new",
      name: "سارا",
      phone: "09121234567",
    });
    expect(result.success && result.data.shippingAddress).toBeNull();
  });

  it("merges duplicate variants and ignores blank lines", () => {
    const result = parseOrderForm(
      form({
        ...existingCustomer,
        "items.0.variantId": "v1",
        "items.0.quantity": "1",
        "items.1.variantId": "",
        "items.1.quantity": "5",
        "items.2.variantId": "v1",
        "items.2.quantity": "2",
      }),
    );
    expect(result.success && result.data.items).toEqual([{ variantId: "v1", quantity: 3 }]);
  });

  it("requires a customer", () => {
    const result = parseOrderForm(
      form({ customerMode: "existing", "items.0.variantId": "v1", "items.0.quantity": "1" }),
    );
    expect(result.success).toBe(false);
    expect(!result.success && result.errors.customerId).toBeDefined();
  });

  it("validates new customer fields", () => {
    const result = parseOrderForm(
      form({
        customerMode: "new",
        customerName: "",
        customerPhone: "12345",
        "items.0.variantId": "v1",
        "items.0.quantity": "1",
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.customerName).toBeDefined();
      expect(result.errors.customerPhone).toBeDefined();
    }
  });

  it("requires at least one item", () => {
    const result = parseOrderForm(form({ ...existingCustomer }));
    expect(!result.success && result.errors.items).toBeDefined();
  });

  it.each(["0", "-2", "abc", String(MAX_QUANTITY + 1)])("rejects quantity %s", (qty) => {
    const result = parseOrderForm(
      form({ ...existingCustomer, "items.0.variantId": "v1", "items.0.quantity": qty }),
    );
    expect(!result.success && result.errors["items.0.quantity"]).toBeDefined();
  });

  it("rejects a merged quantity above the limit", () => {
    const result = parseOrderForm(
      form({
        ...existingCustomer,
        "items.0.variantId": "v1",
        "items.0.quantity": String(MAX_QUANTITY),
        "items.1.variantId": "v1",
        "items.1.quantity": "1",
      }),
    );
    expect(!result.success && result.errors.items).toBeDefined();
  });
});
