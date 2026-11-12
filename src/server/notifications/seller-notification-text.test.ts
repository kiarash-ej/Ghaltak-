import { describe, expect, it } from "vitest";
import { notificationHref, orderNotificationText, subscriptionEndingText } from "./seller-notification-text";

describe("in-app notification texts", () => {
  it("names the customer and the order code", () => {
    const o = { code: "K3F9QZ", customerName: "سارا" };
    expect(orderNotificationText("ORDER_NEW", o)).toBe("سارا با لینک خرید سفارش K3F9QZ را ثبت کرد.");
    expect(orderNotificationText("RECEIPT_UPLOADED", o)).toContain("رسید کارت‌به‌کارت");
    expect(orderNotificationText("ORDER_PAID_ONLINE", o)).toContain("آنلاین پرداخت کرد");
  });

  it("says «مشتری» when there is no name", () => {
    expect(orderNotificationText("ORDER_NEW", { code: "K3F9QZ", customerName: "  " })).toMatch(/^مشتری /);
    expect(orderNotificationText("ORDER_NEW", { code: "K3F9QZ", customerName: null })).toMatch(/^مشتری /);
  });

  it("tells a trial from a paid period", () => {
    const end = new Date("2026-11-20T12:00:00Z");
    expect(subscriptionEndingText("TRIAL", end)).toMatch(/^دورهٔ آزمایشی فروشگاه/);
    expect(subscriptionEndingText("ACTIVE", end)).toMatch(/^اشتراک فروشگاه/);
  });

  it("links to the order, or to billing", () => {
    expect(notificationHref({ kind: "ORDER_NEW", orderId: "abc" })).toBe("/orders/abc");
    expect(notificationHref({ kind: "RECEIPT_UPLOADED", orderId: null })).toBe("/orders");
    expect(notificationHref({ kind: "SUBSCRIPTION_ENDING", orderId: null })).toBe("/settings/billing");
  });
});
