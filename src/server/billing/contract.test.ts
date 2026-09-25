import { describe, expectTypeOf, it } from "vitest";
import type { CanUse, GetPlanUsage } from "./types";
import { canUse, getPlanUsage } from "./usage";

// Track B imports canUse by its contract type (./types.ts); the real functions
// replaced the Step 0 stubs. `npm run typecheck` fails if they drift apart.
describe("plan limits contract", () => {
  it("the real functions have exactly the contract types", () => {
    expectTypeOf(canUse).toEqualTypeOf<CanUse>();
    expectTypeOf(getPlanUsage).toEqualTypeOf<GetPlanUsage>();
  });
});
