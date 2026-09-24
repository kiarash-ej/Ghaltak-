import { describe, expect, it } from "vitest";
import { stockToReturn } from "./stock-return";

describe("stockToReturn", () => {
  it("returns what the order took, per variant", () => {
    expect(
      stockToReturn([
        { variantId: "a", delta: -2 },
        { variantId: "b", delta: -1 },
        { variantId: "a", delta: -1 },
      ]),
    ).toEqual([
      { variantId: "a", quantity: 3 },
      { variantId: "b", quantity: 1 },
    ]);
  });

  it("returns nothing for an order that never took stock (created under the stub)", () => {
    expect(stockToReturn([])).toEqual([]);
  });

  it("never returns twice", () => {
    expect(
      stockToReturn([
        { variantId: "a", delta: -2 },
        { variantId: "a", delta: 2 },
      ]),
    ).toEqual([]);
  });

  it("returns only the part still out after a partial return", () => {
    expect(
      stockToReturn([
        { variantId: "a", delta: -3 },
        { variantId: "a", delta: 1 },
      ]),
    ).toEqual([{ variantId: "a", quantity: 2 }]);
  });
});
