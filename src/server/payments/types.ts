import type { GatewayProvider } from "@/generated/prisma/enums";

// The payment gateway contract (Phase 2, B6). Implemented for Zarinpal in
// ./zarinpal.ts, and by a test-only fake in ./fake-gateway.ts. Track A's
// subscriptions (A9) use the same client with the platform's own merchant id.
//
// Amounts are ALWAYS tomans here, like everywhere in the app; a client that
// talks to a gateway in rials converts at its own edge.

export type GatewayRequestInput = {
  /** Tomans. Computed on the server (amountDue), never read from a form. */
  amount: number;
  /** Where the gateway sends the customer back: /pay/callback/<attemptId>. */
  callbackUrl: string;
  description: string;
  /** Normalized "09xxxxxxxxx"; some gateways prefill it. */
  mobile?: string;
};

export type GatewayRequestResult =
  | { ok: true; authority: string; redirectUrl: string }
  /** `detail`: the gateway's code or message, safe to store; never card data or keys. */
  | { ok: false; detail: string };

export type GatewayVerifyResult =
  | {
      ok: true;
      refId: string;
      /** e.g. "6037-99**-****-1234", as the gateway masks it. */
      cardPanMasked: string | null;
      /** The gateway had already verified it (a repeated callback). */
      alreadyVerified: boolean;
    }
  | {
      ok: false;
      amountMismatch: boolean;
      /**
       * The gateway could not be asked (timeout, network, no answer code): the
       * payment may well have succeeded, so it must be verified again later,
       * never marked failed. A verify of an already-verified payment is safe.
       */
      transient: boolean;
      detail: string;
    };

export interface PaymentGateway {
  readonly provider: GatewayProvider;
  request(input: GatewayRequestInput): Promise<GatewayRequestResult>;
  /** The payment page for an authority from request(), to send the customer back to it. */
  payUrl(authority: string): string;
  /** `amount` must be the one WE recorded for the attempt, never a callback value. */
  verify(input: { authority: string; amount: number }): Promise<GatewayVerifyResult>;
}
