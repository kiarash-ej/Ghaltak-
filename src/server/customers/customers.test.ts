import { describe, expect, it } from "vitest";
import type { OrderStatus } from "@/generated/prisma/enums";
import { parseCustomerForm } from "./customer-form";
import { computeStats, suggestTag } from "./stats";

const day = (n: number) => new Date(Date.UTC(2026, 8, 24) - n * 86_400_000);
const now = day(0);

describe("computeStats", () => {
  const order = (status: OrderStatus, totalPrice: number, daysAgo: number) => ({
    status,
    totalPrice,
    createdAt: day(daysAgo),
  });

  it("counts only paid, not-returned orders as purchases", () => {
    const stats = computeStats([
      order("DELIVERED", 1_000_000, 30),
      order("PAID", 500_000, 2),
      order("SHIPPED", 300_000, 10),
      order("PENDING_PAYMENT", 9_000_000, 1),
      order("CANCELED", 9_000_000, 5),
      order("RETURNED", 9_000_000, 40),
    ]);
    expect(stats).toEqual({
      orderCount: 6,
      purchaseCount: 3,
      totalSpent: 1_800_000,
      averageOrder: 600_000,
      lastPurchaseAt: day(2),
      returnCount: 1,
    });
  });

  it("has no average or last purchase without purchases", () => {
    expect(computeStats([order("CANCELED", 100, 1)])).toMatchObject({
      purchaseCount: 0,
      totalSpent: 0,
      averageOrder: null,
      lastPurchaseAt: null,
    });
    expect(computeStats([]).orderCount).toBe(0);
  });

  it("rounds the average to whole tomans", () => {
    const stats = computeStats([order("PAID", 100, 1), order("PAID", 101, 1)]);
    expect(stats.averageOrder).toBe(101);
  });
});

describe("suggestTag", () => {
  it("suggests NEW for a recent customer with few purchases", () => {
    expect(suggestTag({ purchaseCount: 0, lastPurchaseAt: null, customerCreatedAt: day(3) }, now).tag).toBe("NEW");
    expect(suggestTag({ purchaseCount: 2, lastPurchaseAt: day(5), customerCreatedAt: day(60) }, now).tag).toBe("NEW");
  });

  it("suggests LOYAL from 3 purchases with a recent one", () => {
    expect(suggestTag({ purchaseCount: 3, lastPurchaseAt: day(90), customerCreatedAt: day(300) }, now).tag).toBe("LOYAL");
  });

  it("suggests INACTIVE after 90 idle days, even for a former loyal customer", () => {
    expect(suggestTag({ purchaseCount: 8, lastPurchaseAt: day(91), customerCreatedAt: day(400) }, now).tag).toBe("INACTIVE");
    expect(suggestTag({ purchaseCount: 0, lastPurchaseAt: null, customerCreatedAt: day(120) }, now).tag).toBe("INACTIVE");
  });

  it("always explains itself", () => {
    const s = suggestTag({ purchaseCount: 3, lastPurchaseAt: day(1), customerCreatedAt: day(10) }, now);
    expect(s.reason.length).toBeGreaterThan(0);
  });
});

describe("parseCustomerForm", () => {
  const form = (fields: Record<string, string>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return fd;
  };

  it("normalizes the phone and empties blank fields", () => {
    expect(parseCustomerForm(form({ name: "  سارا  ", phone: "+98 912 123 4567", address: " " }))).toEqual({
      success: true,
      data: { name: "سارا", phone: "09121234567", address: null },
    });
  });

  it("accepts Persian digits in the phone", () => {
    const r = parseCustomerForm(form({ phone: "۰۹۱۲۱۲۳۴۵۶۷" }));
    expect(r.success && r.data.phone).toBe("09121234567");
  });

  it("ignores a tag field: the tag has its own control", () => {
    const r = parseCustomerForm(form({ phone: "09121234567", tag: "LOYAL" }));
    expect(r.success && "tag" in r.data).toBe(false);
  });

  it("rejects a bad phone and a too-long name", () => {
    const r = parseCustomerForm(form({ name: "ن".repeat(81), phone: "021-1234" }));
    expect(r.success).toBe(false);
    if (!r.success) expect(Object.keys(r.errors).sort()).toEqual(["name", "phone"]);
  });
});
