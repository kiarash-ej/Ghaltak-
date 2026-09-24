import { describe, expect, it } from "vitest";
import {
  MAX_SHIPPING_COST,
  parseShippingForm,
  shipBlocker,
  shippingMethodLabel,
  shippingStatusFor,
} from "./shipping";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

describe("shipBlocker", () => {
  it("requires a shipping method before SHIPPED", () => {
    expect(shipBlocker({ shippingMethod: null })).not.toBeNull();
    expect(shipBlocker({ shippingMethod: "" })).not.toBeNull();
    expect(shipBlocker({ shippingMethod: "POST" })).toBeNull();
  });
});

describe("shippingStatusFor", () => {
  it("keeps shipping status in step with the order", () => {
    expect(shippingStatusFor("SHIPPED")).toBe("IN_TRANSIT");
    expect(shippingStatusFor("DELIVERED")).toBe("DELIVERED");
    expect(shippingStatusFor("CANCELED")).toBeUndefined();
    expect(shippingStatusFor("RETURNED")).toBeUndefined();
  });
});

describe("shippingMethodLabel", () => {
  it("labels known methods and shows free text from older rows as is", () => {
    expect(shippingMethodLabel("POST")).toBe("پست");
    expect(shippingMethodLabel("پست پیشتاز")).toBe("پست پیشتاز");
    expect(shippingMethodLabel(null)).toBeNull();
  });
});

describe("parseShippingForm", () => {
  it("parses method, cost (Persian digits, separators) and tracking code", () => {
    expect(
      parseShippingForm(
        form({ method: "POST", cost: "۶۰٬۰۰۰", trackingCode: " ab-۱۲۳۴۵ ", shippingStatus: "" }),
      ),
    ).toEqual({
      success: true,
      data: { method: "POST", cost: 60000, trackingCode: "AB-12345", shippingStatus: null },
    });
  });

  it("treats cost and tracking code as optional", () => {
    const result = parseShippingForm(
      form({ method: "IN_PERSON", cost: "", trackingCode: "", shippingStatus: "" }),
    );
    expect(result).toEqual({
      success: true,
      data: { method: "IN_PERSON", cost: null, trackingCode: null, shippingStatus: null },
    });
  });

  it("accepts a manual FAILED shipping status but not DELIVERED", () => {
    const ok = parseShippingForm(form({ method: "POST", cost: "", trackingCode: "", shippingStatus: "FAILED" }));
    expect(ok.success && ok.data.shippingStatus).toBe("FAILED");
    const bad = parseShippingForm(
      form({ method: "POST", cost: "", trackingCode: "", shippingStatus: "DELIVERED" }),
    );
    expect(!bad.success && bad.errors.shippingStatus).toBeDefined();
  });

  it.each([
    [{ method: "" }, "method"],
    [{ method: "DRONE" }, "method"],
    [{ cost: "abc" }, "cost"],
    [{ cost: "-5" }, "cost"],
    [{ cost: String(MAX_SHIPPING_COST + 1) }, "cost"],
    [{ trackingCode: "12" }, "trackingCode"],
    [{ trackingCode: "<script>" }, "trackingCode"],
  ])("rejects %o", (override, field) => {
    const result = parseShippingForm(
      form({ method: "POST", cost: "", trackingCode: "", shippingStatus: "", ...override }),
    );
    expect(result.success).toBe(false);
    expect(!result.success && result.errors[field]).toBeDefined();
  });
});
