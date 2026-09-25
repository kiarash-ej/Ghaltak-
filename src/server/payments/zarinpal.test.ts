import { describe, expect, it } from "vitest";
import { createZarinpalClient, tomanToRial } from "./zarinpal";

const MERCHANT = "1344b5d4-0048-11e8-94db-005056a205be";

/** A fake fetch that records calls and answers with `reply`. */
function fakeFetch(reply: { status?: number; body: unknown } | Error) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init?.body)) });
    if (reply instanceof Error) throw reply;
    return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

describe("tomanToRial", () => {
  it("converts at the gateway edge only", () => {
    expect(tomanToRial(560_000)).toBe(5_600_000);
  });
});

describe("zarinpal request", () => {
  it("sends rials, callback and mobile, and returns the StartPay URL", async () => {
    const f = fakeFetch({ body: { data: { code: 100, authority: "A0000000000000000000000000000wwOGYpd" }, errors: [] } });
    const client = createZarinpalClient({ merchantId: MERCHANT, sandbox: false, fetch: f.fn });
    const r = await client.request({
      amount: 560_000,
      callbackUrl: "https://ghaltak.example/pay/callback/att_1",
      description: "سفارش K3F9QZ",
      mobile: "09121234567",
    });
    expect(r).toEqual({
      ok: true,
      authority: "A0000000000000000000000000000wwOGYpd",
      redirectUrl: "https://payment.zarinpal.com/pg/StartPay/A0000000000000000000000000000wwOGYpd",
    });
    expect(f.calls[0].url).toBe("https://payment.zarinpal.com/pg/v4/payment/request.json");
    expect(f.calls[0].body).toEqual({
      merchant_id: MERCHANT,
      amount: 5_600_000,
      callback_url: "https://ghaltak.example/pay/callback/att_1",
      description: "سفارش K3F9QZ",
      metadata: { mobile: "09121234567" },
    });
  });

  it("uses the sandbox host when asked", async () => {
    const f = fakeFetch({ body: { data: { code: 100, authority: "S0000000000000000000000000000000abcd" } } });
    const r = await createZarinpalClient({ merchantId: MERCHANT, sandbox: true, fetch: f.fn }).request({
      amount: 1000,
      callbackUrl: "https://x/pay/callback/a",
      description: "test",
    });
    expect(f.calls[0].url).toBe("https://sandbox.zarinpal.com/pg/v4/payment/request.json");
    expect(r.ok && r.redirectUrl).toBe("https://sandbox.zarinpal.com/pg/StartPay/S0000000000000000000000000000000abcd");
  });

  it("reports a refused request by its code only", async () => {
    const f = fakeFetch({ status: 400, body: { data: [], errors: { code: -9, message: "The input params invalid" } } });
    const r = await createZarinpalClient({ merchantId: MERCHANT, sandbox: false, fetch: f.fn }).request({
      amount: 1000,
      callbackUrl: "https://x/pay/callback/a",
      description: "test",
    });
    expect(r).toEqual({ ok: false, detail: "code -9" });
  });

  it("never leaks the merchant id when the network fails", async () => {
    const f = fakeFetch(new TypeError(`fetch failed for ${MERCHANT}`));
    const r = await createZarinpalClient({ merchantId: MERCHANT, sandbox: false, fetch: f.fn }).request({
      amount: 1000,
      callbackUrl: "https://x/pay/callback/a",
      description: "test",
    });
    expect(r).toEqual({ ok: false, detail: "NETWORK" });
    expect(JSON.stringify(r)).not.toContain(MERCHANT);
  });
});

describe("zarinpal verify", () => {
  const verify = (reply: Parameters<typeof fakeFetch>[0]) => {
    const f = fakeFetch(reply);
    const p = createZarinpalClient({ merchantId: MERCHANT, sandbox: false, fetch: f.fn }).verify({
      authority: "A1",
      amount: 560_000,
    });
    return { p, f };
  };

  it("verifies with OUR amount, in rials", async () => {
    const { p, f } = verify({ body: { data: { code: 100, ref_id: 201, card_pan: "502229******5995" } } });
    expect(await p).toEqual({ ok: true, refId: "201", cardPanMasked: "502229******5995", alreadyVerified: false });
    expect(f.calls[0].url).toBe("https://payment.zarinpal.com/pg/v4/payment/verify.json");
    expect(f.calls[0].body).toEqual({ merchant_id: MERCHANT, amount: 5_600_000, authority: "A1" });
  });

  it("treats code 101 (already verified) as success", async () => {
    const { p } = verify({ body: { data: { code: 101, ref_id: 201, card_pan: null } } });
    expect(await p).toMatchObject({ ok: true, refId: "201", alreadyVerified: true });
  });

  it("flags an amount mismatch", async () => {
    const { p } = verify({ status: 400, body: { data: [], errors: { code: -50, message: "amounts not same" } } });
    expect(await p).toEqual({ ok: false, amountMismatch: true, detail: "code -50" });
  });

  it("reports other failures without success", async () => {
    const { p } = verify({ status: 400, body: { data: [], errors: { code: -51, message: "failed" } } });
    expect(await p).toEqual({ ok: false, amountMismatch: false, detail: "code -51" });
  });

  it("does not count code 100 without a ref id as success", async () => {
    const { p } = verify({ body: { data: { code: 100 } } });
    expect((await p).ok).toBe(false);
  });
});
