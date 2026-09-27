import { describe, expect, it, vi } from "vitest";
import {
  consoleProvider,
  kavenegarProvider,
  lookupTokens,
  maskMobile,
  parseSmsIrTemplate,
  providerFromEnv,
  smsIrProvider,
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

describe("smsIrProvider", () => {
  const templates = { LOGIN_OTP: { id: 123456, params: ["Code"] } };

  it("posts to send/verify with the key in the header, and returns the message id", async () => {
    const fetch = fakeFetch(200, { status: 1, message: "موفق", data: { messageId: 88912345, cost: 1 } });
    const provider = smsIrProvider({ apiKey: API_KEY, templates, fetch });

    const result = await provider.send({ to: "09121234567", kind: "LOGIN_OTP", tokens: ["482913"] });

    expect(result).toEqual({ ok: true, providerId: "88912345" });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.sms.ir/v1/send/verify");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["X-API-KEY"]).toBe(API_KEY);
    expect(JSON.parse(String(init.body))).toEqual({
      mobile: "09121234567",
      templateId: 123456,
      parameters: [{ name: "Code", value: "482913" }],
    });
  });

  it("reports sms.ir's error status, never the API key", async () => {
    const provider = smsIrProvider({
      apiKey: API_KEY,
      templates,
      fetch: fakeFetch(400, { status: 113, message: "قالب یافت نشد", data: null }),
    });
    const result = await provider.send({ to: "09121234567", kind: "LOGIN_OTP", tokens: ["482913"] });
    expect(result).toEqual({ ok: false, error: "sms.ir status 113" });
  });

  it("turns a timeout or network error into a failure without the key", async () => {
    const fetch = vi.fn(async () => {
      throw Object.assign(new Error(`X-API-KEY ${API_KEY} rejected`), { name: "TimeoutError" });
    });
    const result = await smsIrProvider({ apiKey: API_KEY, templates, fetch }).send({
      to: "09121234567",
      kind: "LOGIN_OTP",
      tokens: ["482913"],
    });
    expect(result).toEqual({ ok: false, error: "sms.ir request failed (TimeoutError)" });
    expect(JSON.stringify(result)).not.toContain(API_KEY);
  });

  it("fails without calling sms.ir for a kind with no template, the wrong token count or a long value", async () => {
    const fetch = fakeFetch(200, { status: 1 });
    const provider = smsIrProvider({ apiKey: API_KEY, templates, fetch });
    const send = (kind: "LOGIN_OTP" | "ORDER_PAID", tokens: string[]) =>
      provider.send({ to: "09121234567", kind, tokens });

    expect(await send("ORDER_PAID", ["A1B2C3"])).toEqual({
      ok: false,
      error: "no sms.ir template configured for ORDER_PAID",
    });
    expect(await send("LOGIN_OTP", ["1", "2"])).toMatchObject({ ok: false });
    expect(await send("LOGIN_OTP", ["x".repeat(26)])).toMatchObject({ ok: false });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("parseSmsIrTemplate", () => {
  it("reads <templateId>:<Param>[,<Param>...]", () => {
    expect(parseSmsIrTemplate("123456:Code")).toEqual({ id: 123456, params: ["Code"] });
    expect(parseSmsIrTemplate(" 42 : ORDER, LINK ")).toEqual({ id: 42, params: ["ORDER", "LINK"] });
    expect(parseSmsIrTemplate("123456")).toBeNull();
    expect(parseSmsIrTemplate("login:Code")).toBeNull();
    expect(parseSmsIrTemplate("123456:")).toBeNull();
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

  it("uses sms.ir when its key is set, even with a Kavenegar key too", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: 1, data: { messageId: 7 } }), { status: 200 }),
    );
    try {
      const provider = providerFromEnv({
        NODE_ENV: "production",
        SMSIR_API_KEY: API_KEY,
        SMSIR_TEMPLATE: "123456:Code",
        KAVENEGAR_API_KEY: "kavenegar-key",
      });
      expect(await provider.send({ to: "09121234567", kind: "LOGIN_OTP", tokens: ["482913"] })).toEqual({
        ok: true,
        providerId: "7",
      });
      expect(String(fetch.mock.calls[0][0])).toBe("https://api.sms.ir/v1/send/verify");
    } finally {
      fetch.mockRestore();
    }
  });

  it("a malformed sms.ir template variable fails with a message naming it", async () => {
    const provider = providerFromEnv({ SMSIR_API_KEY: API_KEY, SMSIR_TEMPLATE_ORDER_PAID: "ghaltak-paid" });
    const result = await provider.send({ to: "09121234567", kind: "ORDER_PAID", tokens: ["A1B2C3"] });
    expect(result).toEqual({
      ok: false,
      error: "SMSIR_TEMPLATE_ORDER_PAID must look like <templateId>:<ParamName>, e.g. 123456:Code",
    });
    expect(templateEnvName("LOGIN_OTP", "SMSIR")).toBe("SMSIR_TEMPLATE");
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
