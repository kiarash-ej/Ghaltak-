import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeGateway, fakeGatewayAllowed, fakePaymentInfo } from "./fake-gateway";

afterEach(() => vi.unstubAllEnvs());

describe("fakeGatewayAllowed", () => {
  it("is never available in production, even with the e2e switch on", () => {
    expect(fakeGatewayAllowed({ NODE_ENV: "production", E2E_FAKE_GATEWAY: "1" })).toBe(false);
  });

  it("needs the e2e switch outside production too", () => {
    expect(fakeGatewayAllowed({ NODE_ENV: "development" })).toBe(false);
    expect(fakeGatewayAllowed({ NODE_ENV: "development", E2E_FAKE_GATEWAY: "true" })).toBe(false);
    expect(fakeGatewayAllowed({ NODE_ENV: "development", E2E_FAKE_GATEWAY: "1" })).toBe(true);
  });
});

describe("createFakeGateway", () => {
  it("refuses to exist in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("E2E_FAKE_GATEWAY", "1");
    expect(() => createFakeGateway()).toThrow(/not available/);
    expect(fakePaymentInfo("FAKE-anything")).toBeNull();
  });

  it("pays for the recorded amount and refuses a different one", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("E2E_FAKE_GATEWAY", "1");
    const gw = createFakeGateway();
    const req = await gw.request({ amount: 1000, callbackUrl: "http://x/pay/callback/a", description: "t" });
    if (!req.ok) throw new Error("request failed");
    expect(req.redirectUrl).toBe(`/pay/fake/${req.authority}`);
    expect(fakePaymentInfo(req.authority)).toEqual({ amount: 1000, callbackUrl: "http://x/pay/callback/a" });

    expect(await gw.verify({ authority: req.authority, amount: 999 })).toMatchObject({ ok: false, amountMismatch: true });
    expect(await gw.verify({ authority: req.authority, amount: 1000 })).toMatchObject({ ok: true });
  });
});
