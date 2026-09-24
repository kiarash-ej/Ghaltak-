import { describe, expectTypeOf, it } from "vitest";
import { adjustStock } from "./inventory";
import { adjustStock as adjustStockStub } from "./inventory.stub";

// Switching Track B from the stub to the real function must stay a one-line
// import change. `npm run typecheck` fails if the two signatures drift apart.
describe("adjustStock contract", () => {
  it("the stub has exactly the real signature", () => {
    expectTypeOf(adjustStockStub).toEqualTypeOf<typeof adjustStock>();
  });
});
