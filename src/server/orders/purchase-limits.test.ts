import { describe, expect, it } from "vitest";
import {
  MAX_LINK_ORDERS_PER_HOUR,
  MAX_OPEN_ORDERS_PER_PHONE,
  UNPAID_ORDER_TTL_HOURS,
  purchaseQuotaProblem,
  unpaidOrderCutoff,
} from "./purchase-limits";

describe("purchaseQuotaProblem", () => {
  it("allows orders under both limits", () => {
    expect(
      purchaseQuotaProblem({
        openOrdersForPhone: MAX_OPEN_ORDERS_PER_PHONE - 1,
        linkOrdersLastHour: MAX_LINK_ORDERS_PER_HOUR - 1,
      }),
    ).toBeNull();
  });

  it("blocks a phone with too many unpaid orders on the link", () => {
    expect(
      purchaseQuotaProblem({ openOrdersForPhone: MAX_OPEN_ORDERS_PER_PHONE, linkOrdersLastHour: 0 }),
    ).not.toBeNull();
  });

  it("blocks a link that got too many orders in the last hour", () => {
    expect(
      purchaseQuotaProblem({ openOrdersForPhone: 0, linkOrdersLastHour: MAX_LINK_ORDERS_PER_HOUR }),
    ).not.toBeNull();
  });
});

describe("unpaidOrderCutoff", () => {
  it(`is ${UNPAID_ORDER_TTL_HOURS} hours before now`, () => {
    const now = new Date("2026-09-24T12:00:00Z");
    expect(unpaidOrderCutoff(now).toISOString()).toBe("2026-09-22T12:00:00.000Z");
  });
});
