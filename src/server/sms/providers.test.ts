import { describe, expect, it, vi } from "vitest";
import {
  consoleProvider,
  kavenegarProvider,
  lookupTokens,
  maskMobile,
  providerFromEnv,
  templateEnvName,
} from "./providers";

const API_KEY = "SECRET-API-KEY-123";

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

describe("kavenegarProvider", () => {
  const templates = { LOGIN_OTP: "ghaltak-login", ORDER_SHIPPED: "ghaltak-shipped" };

  it("calls verify/lookup with the template and tokens, and returns the message id", async () => {
    const fetch = fakeFetch(200, { return: { status: 200 }, entries: [{ messageid: 8792343 }] });
    const provider = kavenegarProvider({ apiKey: API_KEY, templates, fetch });

    const result = await provider.send({ to: "09121234567", kind: "ORDER_SHIPPED", tokens: ["A1B2C3", "پست پیشتاز", "123"] });

    expect(result).toEqual({ ok: true, providerId: "8792343" });
    const url = new URL(String((fetch.mock.calls[0] as unknown[])[0]));
    expect(url.pathname).toBe(`/v1/${API_KEY}/verify/lookup.json`);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      receptor: "09121234567",
      template: "ghaltak-shipped",
      token: "A1B2C3",
      token2: "پست‌پیشتاز", // no spaces allowed: a نیم‌فاصله instead
      token3: "123",
    });
  });

  it("reports Kavenegar's error status, never the API key", async () => {
    const provider = kavenegarProvider({
      apiKey: API_KEY,
      templates,
      fetch: fakeFetch(418, { return: { status: 418, message: "اعتبار کافی نیست" } }),
    });
    const result = await provider.send({ to: "09121234567", kind: "LOGIN_OTP", tokens: ["123456"] });
    expect(result).toEqual({ ok: false, error: "Kavenegar status 418" });
  });

  it("turns a timeout or network error into a failure without the URL", async () => {
    const fetch = vi.fn(async () => {
      throw Object.assign(new Error(`request to https://api.kavenegar.com/v1/${API_KEY}/... failed`), {
        name: "TimeoutError",
      });
    });
    const result = await kavenegarProvider({ apiKey: API_KEY, templates, fetch }).send({
      to: "09121234567",
      kind: "LOGIN_OTP",
      tokens: ["123456"],
    });
    expect(result).toEqual({ ok: false, error: "Kavenegar request failed (TimeoutError)" });
    expect(JSON.stringify(result)).not.toContain(API_KEY);
  });

  it("fails without calling Kavenegar when the kind has no template", async () => {
    const fetch = fakeFetch(200, {});
    const result = await kavenegarProvider({ apiKey: API_KEY, templates, fetch }).send({
      to: "09121234567",
      kind: "ORDER_PAID",
      tokens: ["A1B2C3"],
    });
    expect(result).toEqual({ ok: false, error: "no Kavenegar template configured for ORDER_PAID" });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("lookupTokens", () => {
  it("accepts 1 to 3 tokens of at most 100 characters", () => {
    expect(lookupTokens(["a"]).ok).toBe(true);
    expect(lookupTokens(["a", "b", "c"]).ok).toBe(true);
    expect(lookupTokens([]).ok).toBe(false);
    expect(lookupTokens(["a", "b", "c", "d"]).ok).toBe(false);
    expect(lookupTokens(["  "]).ok).toBe(false);
    expect(lookupTokens(["x".repeat(101)]).ok).toBe(false);
  });
});

describe("providerFromEnv", () => {
  it("uses the console in development without a key", () => {
    expect(providerFromEnv({ NODE_ENV: "development" }).mode).toBe("DEV");
  });

  it("never prints codes in production: without a key every send fails", async () => {
    const provider = providerFromEnv({ NODE_ENV: "production" });
    expect(provider.mode).toBe("LIVE");
    expect(await provider.send({ to: "09121234567", kind: "LOGIN_OTP", tokens: ["123456"] })).toMatchObject({
      ok: false,
    });
  });

  it("reads each kind's template from its own variable", () => {
    expect(templateEnvName("LOGIN_OTP")).toBe("KAVENEGAR_TEMPLATE");
    expect(templateEnvName("ORDER_PAID")).toBe("KAVENEGAR_TEMPLATE_ORDER_PAID");
    expect(providerFromEnv({ KAVENEGAR_API_KEY: "k", KAVENEGAR_TEMPLATE: "t" }).mode).toBe("LIVE");
  });
});

describe("logs", () => {
  it("mask the mobile number", async () => {
    expect(maskMobile("09121234567")).toBe("0912***4567");
    const lines: string[] = [];
    await consoleProvider((l) => lines.push(l)).send({ to: "09121234567", kind: "LOGIN_OTP", tokens: ["123456"] });
    expect(lines).toEqual(["[sms DEV] LOGIN_OTP to 0912***4567: 123456"]);
  });
});
