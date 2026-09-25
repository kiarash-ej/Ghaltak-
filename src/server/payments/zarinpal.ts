import type { PaymentGateway } from "./types";

// Zarinpal payment gateway, API v4 (https://www.zarinpal.com/docs/):
//   request: POST {base}/pg/v4/payment/request.json -> data.code 100, data.authority
//   pay:     {base}/pg/StartPay/{authority}
//   return:  callback_url?Authority=...&Status=OK|NOK
//   verify:  POST {base}/pg/v4/payment/verify.json -> data.code 100 (verified now)
//            or 101 (already verified before), data.ref_id, data.card_pan
// Sandbox: the same paths on sandbox.zarinpal.com, with any UUID as merchant id.
//
// Zarinpal counts in RIALS by default, the app in tomans: converted here only.
// Works with any merchant id, so A9 can use it with the platform's own gateway.

export const ZARINPAL_BASE = {
  live: "https://payment.zarinpal.com",
  sandbox: "https://sandbox.zarinpal.com",
} as const;

/** Zarinpal's "amounts are not the same" error on verify. */
const AMOUNT_MISMATCH_CODES = new Set([-50]);

const TIMEOUT_MS = 10_000;

export function tomanToRial(tomans: number): number {
  return tomans * 10;
}

type Fetch = typeof fetch;

type ZarinpalResponse = {
  data?: { code?: number; authority?: string; ref_id?: number | string; card_pan?: string } | unknown[];
  errors?: { code?: number; message?: string } | unknown[];
};

function codeOf(body: ZarinpalResponse): number | undefined {
  if (body.data && !Array.isArray(body.data) && typeof body.data.code === "number") return body.data.code;
  if (body.errors && !Array.isArray(body.errors) && typeof body.errors.code === "number") return body.errors.code;
  return undefined;
}

export function createZarinpalClient(opts: {
  merchantId: string;
  sandbox: boolean;
  fetch?: Fetch;
}): PaymentGateway {
  const base = opts.sandbox ? ZARINPAL_BASE.sandbox : ZARINPAL_BASE.live;
  const doFetch = opts.fetch ?? fetch;

  async function post(path: string, body: Record<string, unknown>): Promise<ZarinpalResponse | { failed: string }> {
    try {
      const res = await doFetch(`${base}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      // Zarinpal answers errors with 4xx and a JSON body; read it either way.
      return (await res.json().catch(() => ({ errors: { message: `HTTP ${res.status}` } }))) as ZarinpalResponse;
    } catch (err) {
      // Never the merchant id or the body: only what kind of failure it was.
      return { failed: (err as Error)?.name === "TimeoutError" ? "TIMEOUT" : "NETWORK" };
    }
  }

  return {
    provider: "ZARINPAL",

    async request(input) {
      const body = await post("/pg/v4/payment/request.json", {
        merchant_id: opts.merchantId,
        amount: tomanToRial(input.amount),
        callback_url: input.callbackUrl,
        description: input.description,
        ...(input.mobile ? { metadata: { mobile: input.mobile } } : {}),
      });
      if ("failed" in body) return { ok: false, detail: body.failed };
      const code = codeOf(body);
      const authority = !Array.isArray(body.data) ? body.data?.authority : undefined;
      if (code === 100 && authority) {
        return { ok: true, authority, redirectUrl: `${base}/pg/StartPay/${encodeURIComponent(authority)}` };
      }
      return { ok: false, detail: `code ${code ?? "?"}` };
    },

    async verify({ authority, amount }) {
      const body = await post("/pg/v4/payment/verify.json", {
        merchant_id: opts.merchantId,
        amount: tomanToRial(amount),
        authority,
      });
      if ("failed" in body) return { ok: false, amountMismatch: false, detail: body.failed };
      const code = codeOf(body);
      const data = !Array.isArray(body.data) ? body.data : undefined;
      if ((code === 100 || code === 101) && data?.ref_id !== undefined) {
        return {
          ok: true,
          refId: String(data.ref_id),
          cardPanMasked: data.card_pan ?? null,
          alreadyVerified: code === 101,
        };
      }
      return {
        ok: false,
        amountMismatch: code !== undefined && AMOUNT_MISMATCH_CODES.has(code),
        detail: `code ${code ?? "?"}`,
      };
    },
  };
}
