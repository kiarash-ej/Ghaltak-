// Charging for subscriptions (docs/phase2/README.md, decision 4). On only when
// BILLING_ENABLED is exactly "true". Off (production until the week-6
// decision): plans are shown and usage counted, but nothing expires, nothing
// is limited and there is no way to pay.

type Env = Record<string, string | undefined>;

export function billingEnabled(env: Env = process.env): boolean {
  return env.BILLING_ENABLED === "true";
}
