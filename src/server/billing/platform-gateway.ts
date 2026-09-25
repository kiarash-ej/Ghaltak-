import "server-only";
import { createFakeGateway, fakeGatewayAllowed } from "@/server/payments/fake-gateway";
import type { PaymentGateway } from "@/server/payments/types";
import { createZarinpalClient } from "@/server/payments/zarinpal";

// The platform's OWN gateway, for subscription payments only (decision 1:
// customers' order payments go to each seller's gateway). Configured by
// PLATFORM_GATEWAY_* (.env.example). "FAKE" is the end-to-end test's gateway,
// honored only where fakeGatewayAllowed() (never in production).

type Env = Record<string, string | undefined>;

/** The client, or null when the platform gateway isn't configured. */
export function platformGateway(env: Env = process.env): PaymentGateway | null {
  const provider = env.PLATFORM_GATEWAY_PROVIDER || "ZARINPAL";
  if (provider === "FAKE") return fakeGatewayAllowed(env) ? createFakeGateway() : null;
  if (provider !== "ZARINPAL" || !env.PLATFORM_GATEWAY_MERCHANT_ID) return null;
  return createZarinpalClient({
    merchantId: env.PLATFORM_GATEWAY_MERCHANT_ID,
    sandbox: env.PLATFORM_GATEWAY_SANDBOX === "true",
  });
}
