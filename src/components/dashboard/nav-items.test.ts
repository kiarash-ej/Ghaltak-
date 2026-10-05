import { describe, expect, it } from "vitest";
import { activeNavKey } from "./nav-items";

describe("activeNavKey", () => {
  it("home only on / itself", () => {
    expect(activeNavKey("/")).toBe("home");
  });

  it("the most specific entry wins: purchase links live under /orders", () => {
    expect(activeNavKey("/orders")).toBe("orders");
    expect(activeNavKey("/orders/cm1234567890abcdefghijkl")).toBe("orders");
    expect(activeNavKey("/orders/links")).toBe("links");
  });

  it("products and inventory are one tab", () => {
    expect(activeNavKey("/products/new")).toBe("products");
    expect(activeNavKey("/inventory")).toBe("products");
    expect(activeNavKey("/inventory/cm1234567890abcdefghijkl")).toBe("products");
  });

  it("finance, customers, settings", () => {
    expect(activeNavKey("/reports")).toBe("finance");
    expect(activeNavKey("/finance/reports/1405-07")).toBe("finance");
    expect(activeNavKey("/customers/abc")).toBe("customers");
    expect(activeNavKey("/settings/devices")).toBe("settings");
  });

  it("no tab for pages outside the navigation, and no partial-word matches", () => {
    expect(activeNavKey("/select-store")).toBeNull();
    expect(activeNavKey("/ordersx")).toBeNull();
  });
});
