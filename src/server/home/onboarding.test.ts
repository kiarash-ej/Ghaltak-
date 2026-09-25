import { describe, expect, it } from "vitest";
import { isOnboardingComplete, onboardingSteps, type OnboardingFacts } from "./onboarding";

const none: OnboardingFacts = {
  storeComplete: false,
  hasProduct: false,
  hasCard: false,
  hasPurchaseLink: false,
  hasOrder: false,
};

describe("onboarding checklist", () => {
  it("lists the five steps in order, each linking to its own page", () => {
    expect(onboardingSteps(none).map((s) => [s.key, s.href])).toEqual([
      ["storeComplete", "/settings"],
      ["hasProduct", "/products/new"],
      ["hasCard", "/settings/payments"],
      ["hasPurchaseLink", "/orders/links"],
      ["hasOrder", "/orders/new"],
    ]);
  });

  it("ticks exactly the steps whose fact is true", () => {
    const steps = onboardingSteps({ ...none, hasProduct: true, hasCard: true });
    expect(steps.filter((s) => s.done).map((s) => s.key)).toEqual(["hasProduct", "hasCard"]);
    expect(isOnboardingComplete(steps)).toBe(false);
  });

  it("is complete (and hidden) only when every step is done", () => {
    const all = { storeComplete: true, hasProduct: true, hasCard: true, hasPurchaseLink: true, hasOrder: true };
    expect(isOnboardingComplete(onboardingSteps(all))).toBe(true);
    for (const key of Object.keys(all) as (keyof OnboardingFacts)[]) {
      expect(isOnboardingComplete(onboardingSteps({ ...all, [key]: false }))).toBe(false);
    }
  });
});
