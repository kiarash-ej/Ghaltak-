import { describe, expect, it } from "vitest";
import type { OrderStatus } from "@/generated/prisma/enums";
import {
  ORDER_STATUSES,
  canTransition,
  isOpenStatus,
  isOrderStatus,
  nextStatuses,
  restoresStock,
} from "./status";

describe("canTransition", () => {
  it.each<[OrderStatus, OrderStatus]>([
    ["PENDING_PAYMENT", "PAID"],
    ["PAID", "PREPARING"],
    ["PREPARING", "SHIPPED"],
    ["SHIPPED", "DELIVERED"],
    ["PENDING_PAYMENT", "CANCELED"],
    ["PAID", "CANCELED"],
    ["PREPARING", "CANCELED"],
    ["SHIPPED", "RETURNED"],
    ["DELIVERED", "RETURNED"],
  ])("allows %s → %s", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each<[OrderStatus, OrderStatus]>([
    ["PENDING_PAYMENT", "SHIPPED"], // skipping payment
    ["PENDING_PAYMENT", "DELIVERED"],
    ["PAID", "PENDING_PAYMENT"], // going backwards
    ["DELIVERED", "SHIPPED"],
    ["SHIPPED", "CANCELED"], // already left the shop: return, not cancel
    ["DELIVERED", "CANCELED"],
    ["PENDING_PAYMENT", "RETURNED"], // nothing to return yet
  ])("rejects %s → %s", (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it("never allows staying in the same status", () => {
    for (const s of ORDER_STATUSES) expect(canTransition(s, s)).toBe(false);
  });

  it("treats CANCELED and RETURNED as final", () => {
    for (const to of ORDER_STATUSES) {
      expect(canTransition("CANCELED", to)).toBe(false);
      expect(canTransition("RETURNED", to)).toBe(false);
    }
    expect(nextStatuses("CANCELED")).toEqual([]);
    expect(nextStatuses("RETURNED")).toEqual([]);
  });

  it("can reach DELIVERED from PENDING_PAYMENT along the happy path", () => {
    const path: OrderStatus[] = ["PENDING_PAYMENT", "PAID", "PREPARING", "SHIPPED", "DELIVERED"];
    for (let i = 1; i < path.length; i++) {
      expect(canTransition(path[i - 1], path[i])).toBe(true);
    }
  });
});

describe("restoresStock", () => {
  it("is true only for cancel and return", () => {
    const restoring = ORDER_STATUSES.filter(restoresStock);
    expect(restoring).toEqual(["CANCELED", "RETURNED"]);
  });

  it("is never reachable twice for the same order", () => {
    // Stock must be restored at most once: after a restoring status there is
    // no way out, so an order can never restore (or re-reduce) again.
    for (const s of ORDER_STATUSES.filter(restoresStock)) {
      expect(nextStatuses(s)).toEqual([]);
    }
  });
});

describe("isOrderStatus", () => {
  it("accepts known statuses and rejects anything else", () => {
    expect(isOrderStatus("PAID")).toBe(true);
    expect(isOrderStatus("paid")).toBe(false);
    expect(isOrderStatus("")).toBe(false);
    expect(isOrderStatus(undefined)).toBe(false);
  });
});

describe("isOpenStatus", () => {
  it("excludes finished orders", () => {
    expect(ORDER_STATUSES.filter(isOpenStatus)).toEqual([
      "PENDING_PAYMENT",
      "PAID",
      "PREPARING",
      "SHIPPED",
    ]);
  });
});
