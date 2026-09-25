import { describe, expect, it } from "vitest";
import { SMS_SWITCH, customerSmsTokens } from "./customer-sms-tokens";

const data = { orderCode: "K3F9QZ", orderUrl: "https://ghaltak.ir/buy/order/uQRNyjuWjeb8YSNhemdMTQ" };

describe("customerSmsTokens", () => {
  it("sends code and link for placed, paid and reminder", () => {
    for (const kind of ["ORDER_PLACED", "ORDER_PAID", "PAYMENT_REMINDER"] as const) {
      expect(customerSmsTokens(kind, data)).toEqual(["K3F9QZ", data.orderUrl]);
    }
  });

  it("puts the tracking code in the shipped message, or «ندارد»", () => {
    expect(customerSmsTokens("ORDER_SHIPPED", { ...data, trackingCode: "1234567890" })).toEqual([
      "K3F9QZ",
      "1234567890",
      data.orderUrl,
    ]);
    expect(customerSmsTokens("ORDER_SHIPPED", { ...data, trackingCode: null })[1]).toBe("ندارد");
  });

  it("never exceeds 3 values of 100 characters (Kavenegar's limits)", () => {
    const long = { orderCode: "X".repeat(150), orderUrl: `https://x/${"y".repeat(200)}`, trackingCode: "Z".repeat(120) };
    for (const kind of ["ORDER_PLACED", "ORDER_PAID", "ORDER_SHIPPED", "PAYMENT_REMINDER"] as const) {
      const tokens = customerSmsTokens(kind, long);
      expect(tokens.length).toBeLessThanOrEqual(3);
      for (const t of tokens) expect(t.length).toBeLessThanOrEqual(100);
    }
  });
});

describe("SMS_SWITCH", () => {
  it("maps every kind to one of the seller's three switches", () => {
    expect(SMS_SWITCH).toEqual({
      ORDER_PLACED: "smsOnOrderPlaced",
      PAYMENT_REMINDER: "smsOnOrderPlaced",
      ORDER_PAID: "smsOnPaid",
      ORDER_SHIPPED: "smsOnShipped",
    });
  });
});
