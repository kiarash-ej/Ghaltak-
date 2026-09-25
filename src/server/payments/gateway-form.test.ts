import { describe, expect, it } from "vitest";
import { parseGatewayForm } from "./gateway-form";

const MERCHANT = "1344B5D4-0048-11E8-94DB-005056A205BE";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}
const ctx = { hasSavedMerchant: false, fakeAllowed: false };

describe("parseGatewayForm", () => {
  it("accepts a merchant id (lower-cased) with switches", () => {
    expect(parseGatewayForm(form({ merchantId: ` ${MERCHANT} `, sandbox: "on", isActive: "on" }), ctx)).toEqual({
      success: true,
      data: { merchantId: MERCHANT.toLowerCase(), sandbox: true, isActive: true, fake: false },
    });
  });

  it("keeps the saved merchant id when the field is empty", () => {
    const r = parseGatewayForm(form({ merchantId: "", isActive: "on" }), { ...ctx, hasSavedMerchant: true });
    expect(r.success && "merchantId" in r.data).toBe(false);
    expect(r.success && r.data.isActive).toBe(true);
  });

  it("refuses a malformed merchant id", () => {
    const r = parseGatewayForm(form({ merchantId: "12345" }), ctx);
    expect(!r.success && r.errors.merchantId).toBeDefined();
  });

  it("can't turn online payment on without any merchant id", () => {
    const r = parseGatewayForm(form({ isActive: "on" }), ctx);
    expect(!r.success && r.errors.merchantId).toBeDefined();
  });

  it("ignores the fake-gateway box unless the fake gateway is allowed", () => {
    const off = parseGatewayForm(form({ fake: "on", merchantId: MERCHANT }), ctx);
    expect(off.success && off.data.fake).toBe(false);

    const on = parseGatewayForm(form({ fake: "on", isActive: "on" }), { ...ctx, fakeAllowed: true });
    expect(on).toEqual({ success: true, data: { sandbox: false, isActive: true, fake: true } });
  });
});
