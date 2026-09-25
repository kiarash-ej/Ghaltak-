import { randomUUID } from "node:crypto";
import type { PaymentGateway } from "./types";

// A pretend gateway for the end-to-end test (docs/phase2/TRACK-B.md, B6).
// Its "payment page" is /pay/fake/<authority>, with "pay" and "cancel"
// buttons that return to the callback like a real gateway would.
//
// DANGER: with it anyone could mark an order paid. It exists only when the
// app is NOT in production AND E2E_FAKE_GATEWAY=1. Both checks, always.

type Env = Record<string, string | undefined>;

export function fakeGatewayAllowed(env: Env = process.env): boolean {
  return env.NODE_ENV !== "production" && env.E2E_FAKE_GATEWAY === "1";
}

type FakeStore = { pending: Map<string, { amount: number; callbackUrl: string }>; refCounter: number };

/**
 * Payments the fake gateway knows about, shared by the whole server process.
 * On globalThis because Next.js loads this module separately for pages and
 * actions and for route handlers (the gateway's return is a route handler).
 */
const store: FakeStore = ((globalThis as { __ghaltakFakeGateway?: FakeStore }).__ghaltakFakeGateway ??= {
  pending: new Map(),
  refCounter: 1000,
});
const pending = store.pending;

export function fakePaymentInfo(authority: string) {
  return fakeGatewayAllowed() ? pending.get(authority) ?? null : null;
}

export function createFakeGateway(): PaymentGateway {
  if (!fakeGatewayAllowed()) throw new Error("The fake payment gateway is not available here.");
  return {
    provider: "ZARINPAL",
    payUrl: (authority) => `/pay/fake/${authority}`,

    async request(input) {
      const authority = `FAKE-${randomUUID()}`;
      pending.set(authority, { amount: input.amount, callbackUrl: input.callbackUrl });
      return { ok: true, authority, redirectUrl: `/pay/fake/${authority}` };
    },

    async verify({ authority, amount }) {
      const payment = pending.get(authority);
      if (!payment) return { ok: false, amountMismatch: false, transient: false, detail: "unknown authority" };
      if (payment.amount !== amount) {
        return { ok: false, amountMismatch: true, transient: false, detail: "amount differs" };
      }
      store.refCounter += 1;
      return { ok: true, refId: `FAKE-${store.refCounter}`, cardPanMasked: "6037-99**-****-1234", alreadyVerified: false };
    },
  };
}
