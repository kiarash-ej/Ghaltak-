import type { SmsKind } from "@/generated/prisma/enums";

// Who actually delivers an SMS. Not server-only, so it can be tested directly;
// the entry point (./send.ts) is server-only.

export type ProviderMessage = { to: string; kind: SmsKind; tokens: string[] };

export type ProviderResult = { ok: true; providerId: string | null } | { ok: false; error: string };

export interface SmsProvider {
  /** DEV: printed to the console only (development). The row is saved as DEV, not SENT. */
  readonly mode: "LIVE" | "DEV";
  /** Never throws. */
  send(message: ProviderMessage): Promise<ProviderResult>;
}

/** "09121234567" → "0912***4567", for logs. */
export function maskMobile(mobile: string): string {
  return mobile.replace(/^(\d{4})\d{3}(\d{4})$/, "$1***$2");
}

const MAX_TOKENS = 3;
const MAX_TOKEN_LENGTH = 100;
const ZWNJ = "‌";

/**
 * Kavenegar lookup tokens: 1 to 3, non-empty, at most 100 characters, no
 * spaces (whitespace becomes a نیم‌فاصله). Returns an error message for input
 * that is a programming mistake rather than something to send.
 */
export function lookupTokens(tokens: string[]): { ok: true; tokens: string[] } | { ok: false; error: string } {
  if (tokens.length < 1 || tokens.length > MAX_TOKENS) {
    return { ok: false, error: `expected 1 to ${MAX_TOKENS} tokens, got ${tokens.length}` };
  }
  const cleaned = tokens.map((t) => t.trim().replace(/\s+/g, ZWNJ));
  if (cleaned.some((t) => t === "" || t.length > MAX_TOKEN_LENGTH)) {
    return { ok: false, error: `each token must be 1 to ${MAX_TOKEN_LENGTH} characters` };
  }
  return { ok: true, tokens: cleaned };
}

/** Development: prints the message instead of sending it. */
export function consoleProvider(log: (line: string) => void = console.log): SmsProvider {
  return {
    mode: "DEV",
    async send({ to, kind, tokens }) {
      log(`[sms DEV] ${kind} to ${maskMobile(to)}: ${tokens.join(" | ")}`);
      return { ok: true, providerId: null };
    },
  };
}

/** Production without a Kavenegar key: every send fails (and is recorded as FAILED). */
export function unconfiguredProvider(): SmsProvider {
  return {
    mode: "LIVE",
    async send() {
      return { ok: false, error: "KAVENEGAR_API_KEY is not configured" };
    },
  };
}

export type KavenegarConfig = {
  apiKey: string;
  /** The approved template name for each kind. */
  templates: Partial<Record<SmsKind, string>>;
  timeoutMs?: number;
  fetch?: typeof fetch;
};

/**
 * Kavenegar's verify/lookup API (https://kavenegar.com/rest.html): a message
 * from an approved template with up to three tokens. The API key is part of
 * the URL, so the URL is never logged or put in an error.
 */
export function kavenegarProvider(config: KavenegarConfig): SmsProvider {
  const doFetch = config.fetch ?? fetch;
  const timeoutMs = config.timeoutMs ?? 10_000;

  return {
    mode: "LIVE",
    async send({ to, kind, tokens }) {
      const template = config.templates[kind];
      if (!template) return { ok: false, error: `no Kavenegar template configured for ${kind}` };
      const checked = lookupTokens(tokens);
      if (!checked.ok) return { ok: false, error: checked.error };

      const url = new URL(
        `https://api.kavenegar.com/v1/${encodeURIComponent(config.apiKey)}/verify/lookup.json`,
      );
      url.searchParams.set("receptor", to);
      url.searchParams.set("template", template);
      const names = ["token", "token2", "token3"];
      checked.tokens.forEach((t, i) => url.searchParams.set(names[i], t));

      try {
        const res = await doFetch(url, { method: "GET", signal: AbortSignal.timeout(timeoutMs) });
        const body = (await res.json().catch(() => null)) as {
          return?: { status?: number };
          entries?: { messageid?: number | string }[];
        } | null;
        const status = body?.return?.status ?? res.status;
        if (!res.ok || status !== 200) return { ok: false, error: `Kavenegar status ${status}` };
        const id = body?.entries?.[0]?.messageid;
        return { ok: true, providerId: id === undefined ? null : String(id) };
      } catch (err) {
        // Timeout or network error. Only the error's name: its message could hold the URL.
        return { ok: false, error: `Kavenegar request failed (${(err as Error)?.name ?? "Error"})` };
      }
    },
  };
}

type Env = Record<string, string | undefined>;

/** The template env variable for each kind. LOGIN_OTP keeps Phase 1's name. */
export function templateEnvName(kind: SmsKind): string {
  return kind === "LOGIN_OTP" ? "KAVENEGAR_TEMPLATE" : `KAVENEGAR_TEMPLATE_${kind}`;
}

const KINDS: SmsKind[] = [
  "LOGIN_OTP",
  "ORDER_PLACED",
  "ORDER_PAID",
  "ORDER_SHIPPED",
  "PAYMENT_REMINDER",
  "MEMBER_INVITE",
  "SUBSCRIPTION_REMINDER",
];

/**
 * Kavenegar when KAVENEGAR_API_KEY is set. Without it: the console in
 * development, and a provider that always fails in production, so login codes
 * are never printed to production logs.
 */
export function providerFromEnv(env: Env = process.env): SmsProvider {
  const apiKey = env.KAVENEGAR_API_KEY;
  if (apiKey) {
    const templates: Partial<Record<SmsKind, string>> = {};
    for (const kind of KINDS) {
      const name = env[templateEnvName(kind)];
      if (name) templates[kind] = name;
    }
    return kavenegarProvider({ apiKey, templates });
  }
  return env.NODE_ENV === "production" ? unconfiguredProvider() : consoleProvider();
}
