import { describe, expect, it } from "vitest";
import { PAYMENT_METHODS, amountDue, isPaymentMethod, paymentState } from "./payment";

describe("isPaymentMethod", () => {
  it("accepts the three manual methods only", () => {
    for (const m of PAYMENT_METHODS) expect(isPaymentMethod(m)).toBe(true);
    expect(isPaymentMethod("ZARINPAL")).toBe(false);
    expect(isPaymentMethod("cash")).toBe(false);
    expect(isPaymentMethod(null)).toBe(false);
  });
});

describe("amountDue", () => {
  it("adds shipping to the items total", () => {
    expect(amountDue({ totalPrice: 3_820_000, shippingCost: 60_000 })).toBe(3_880_000);
  });

  it("is the items total when there is no shipping cost", () => {
    expect(amountDue({ totalPrice: 3_820_000, shippingCost: null })).toBe(3_820_000);
  });
});

describe("paymentState", () => {
  const paidAt = new Date("2026-09-24T10:00:00Z");

  it("is UNPAID while waiting for payment with no receipt", () => {
    expect(paymentState({ status: "PENDING_PAYMENT", paidAt: null, receiptImageUrl: null })).toBe(
      "UNPAID",
    );
  });

  it("is RECEIPT_SUBMITTED when a receipt waits for review", () => {
    expect(
      paymentState({ status: "PENDING_PAYMENT", paidAt: null, receiptImageUrl: "receipts/a.jpg" }),
    ).toBe("RECEIPT_SUBMITTED");
  });

  it("is PAID once the order has moved on with a payment date", () => {
    for (const status of ["PAID", "PREPARING", "SHIPPED", "DELIVERED", "RETURNED"] as const) {
      expect(paymentState({ status, paidAt, receiptImageUrl: null })).toBe("PAID");
    }
  });

  it("is NOT_APPLICABLE for an order canceled before payment", () => {
    expect(paymentState({ status: "CANCELED", paidAt: null, receiptImageUrl: null })).toBe(
      "NOT_APPLICABLE",
    );
  });

  it("still reports PAID for an order canceled after payment (refund is manual)", () => {
    expect(paymentState({ status: "CANCELED", paidAt, receiptImageUrl: null })).toBe("PAID");
  });
});
