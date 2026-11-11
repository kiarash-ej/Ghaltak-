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

/** Production without an SMS key: every send fails (and is recorded as FAILED). */
export function unconfiguredProvider(): SmsProvider {
  return {
    mode: "LIVE",
    async send() {
      return { ok: false, error: "no SMS provider configured (FARAZ_API_KEY, SMSIR_API_KEY or KAVENEGAR_API_KEY)" };
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

/** An sms.ir verify template: its id and the names of its parameters, in token order. */
export type SmsIrTemplate = { id: number; params: string[] };

export type SmsIrConfig = {
  apiKey: string;
  /** The approved template for each kind, or why its variable couldn't be read. */
  templates: Partial<Record<SmsKind, SmsIrTemplate | { error: string }>>;
  timeoutMs?: number;
  fetch?: typeof fetch;
};

/** sms.ir refuses a parameter value longer than this (status 114). */
const SMSIR_MAX_VALUE_LENGTH = 25;

/**
 * "<templateId>:<Param>[,<Param>...]" → the template, e.g. "123456:Code" for
 * a template whose text has #Code#. The parameter names are the ones in the
 * template's text in the sms.ir panel; the message's tokens fill them in order.
 */
export function parseSmsIrTemplate(value: string): SmsIrTemplate | null {
  const match = /^\s*(\d+)\s*:\s*([A-Za-z0-9_]+(?:\s*,\s*[A-Za-z0-9_]+)*)\s*$/.exec(value);
  if (!match) return null;
  return { id: Number(match[1]), params: match[2].split(",").map((p) => p.trim()) };
}

/**
 * sms.ir's verify API (https://sms.ir/rest-api/): a message from an approved
 * template, sent with POST /v1/send/verify and the key in the X-API-KEY
 * header. The key is never logged or put in an error.
 */
export function smsIrProvider(config: SmsIrConfig): SmsProvider {
  const doFetch = config.fetch ?? fetch;
  const timeoutMs = config.timeoutMs ?? 10_000;

  return {
    mode: "LIVE",
    async send({ to, kind, tokens }) {
      const template = config.templates[kind];
      if (!template) return { ok: false, error: `no sms.ir template configured for ${kind}` };
      if ("error" in template) return { ok: false, error: template.error };
      if (tokens.length !== template.params.length) {
        return { ok: false, error: `sms.ir template for ${kind} has ${template.params.length} parameters, got ${tokens.length} tokens` };
      }
      const values = tokens.map((t) => t.trim());
      if (values.some((v) => v === "" || v.length > SMSIR_MAX_VALUE_LENGTH)) {
        return { ok: false, error: `each sms.ir parameter must be 1 to ${SMSIR_MAX_VALUE_LENGTH} characters` };
      }

      try {
        const res = await doFetch("https://api.sms.ir/v1/send/verify", {
          method: "POST",
          headers: { "X-API-KEY": config.apiKey, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            mobile: to,
            templateId: template.id,
            parameters: template.params.map((name, i) => ({ name, value: values[i] })),
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        const body = (await res.json().catch(() => null)) as {
          status?: number;
          data?: { messageId?: number | string } | null;
        } | null;
        const status = body?.status ?? res.status;
        if (!res.ok || status !== 1) return { ok: false, error: `sms.ir status ${status}` };
        const id = body?.data?.messageId;
        return { ok: true, providerId: id === undefined ? null : String(id) };
      } catch (err) {
        // Timeout or network error. Only the error's name, as for Kavenegar.
        return { ok: false, error: `sms.ir request failed (${(err as Error)?.name ?? "Error"})` };
      }
    },
  };
}

/** A Faraz SMS pattern: its code and the names of its variables, in token order. */
export type FarazPattern = { code: string; params: string[] };

export type FarazConfig = {
  apiKey: string;
  /** The sending line («خط فرستنده») in the Faraz panel. */
  lineNumber: string;
  /** The approved pattern for each kind, or why its variable couldn't be read. */
  templates: Partial<Record<SmsKind, FarazPattern | { error: string }>>;
  timeoutMs?: number;
  fetch?: typeof fetch;
};

/** Faraz's documented default line, used when FARAZ_LINE_NUMBER is not set. */
export const FARAZ_DEFAULT_LINE = "90008361";

/**
 * "<patternCode>:<var>[,<var>...]" → the pattern, e.g. "SJ3FgPrE0C:code" for a
 * pattern whose text has %code%. The variable names are the ones defined on the
 * pattern in the Faraz panel; the message's tokens fill them in order.
 */
export function parseFarazPattern(value: string): FarazPattern | null {
  const match = /^\s*([A-Za-z0-9_-]+)\s*:\s*([A-Za-z_][A-Za-z0-9_]*(?:\s*,\s*[A-Za-z_][A-Za-z0-9_]*)*)\s*$/.exec(value);
  if (!match) return null;
  return { code: match[1], params: match[2].split(",").map((p) => p.trim()) };
}

/**
 * Faraz SMS (IPPanel) pattern API (https://docs.farazsms.com/service/post-ws-v1-sms-pattern):
 * POST /ws/v1/sms/pattern with the key in the Api-Key header; sent at once,
 * without a queue. The key is never logged or put in an error. A value longer
 * than the length set on the pattern is held for manual review by Faraz, so
 * patterns' variables should be given enough room in the panel.
 */
export function farazProvider(config: FarazConfig): SmsProvider {
  const doFetch = config.fetch ?? fetch;
  const timeoutMs = config.timeoutMs ?? 10_000;

  return {
    mode: "LIVE",
    async send({ to, kind, tokens }) {
      const template = config.templates[kind];
      if (!template) return { ok: false, error: `no Faraz pattern configured for ${kind}` };
      if ("error" in template) return { ok: false, error: template.error };
      if (tokens.length !== template.params.length) {
        return { ok: false, error: `Faraz pattern for ${kind} has ${template.params.length} variables, got ${tokens.length} tokens` };
      }
      const values = tokens.map((t) => t.trim());
      if (values.some((v) => v === "")) return { ok: false, error: "each Faraz variable must have a value" };

      try {
        const res = await doFetch("https://api.iranpayamak.com/ws/v1/sms/pattern", {
          method: "POST",
          headers: { "Api-Key": config.apiKey, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            code: template.code,
            attributes: Object.fromEntries(template.params.map((name, i) => [name, values[i]])),
            recipient: to,
            line_number: config.lineNumber,
            number_format: "english",
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        const body = (await res.json().catch(() => null)) as { status?: string; data?: number | string | null } | null;
        if (!res.ok || body?.status !== "success") return { ok: false, error: `Faraz status ${res.status}` };
        const id = body.data;
        return { ok: true, providerId: id === undefined || id === null ? null : String(id) };
      } catch (err) {
        // Timeout or network error. Only the error's name, as for the others.
        return { ok: false, error: `Faraz request failed (${(err as Error)?.name ?? "Error"})` };
      }
    },
  };
}

type Env = Record<string, string | undefined>;

/** The template env variable for each kind. LOGIN_OTP keeps Phase 1's name. */
export function templateEnvName(kind: SmsKind, prefix: "KAVENEGAR" | "SMSIR" | "FARAZ" = "KAVENEGAR"): string {
  return kind === "LOGIN_OTP" ? `${prefix}_TEMPLATE` : `${prefix}_TEMPLATE_${kind}`;
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
 * Faraz SMS when FARAZ_API_KEY is set, otherwise sms.ir when SMSIR_API_KEY is
 * set, otherwise Kavenegar when KAVENEGAR_API_KEY is set. Without any: the
 * console in development, and a provider that always fails in production, so
 * login codes are never printed to production logs.
 */
export function providerFromEnv(env: Env = process.env): SmsProvider {
  const farazKey = env.FARAZ_API_KEY;
  if (farazKey) {
    const templates: FarazConfig["templates"] = {};
    for (const kind of KINDS) {
      const name = templateEnvName(kind, "FARAZ");
      const value = env[name];
      if (!value) continue;
      templates[kind] = parseFarazPattern(value) ?? {
        error: `${name} must look like <patternCode>:<variable>, e.g. SJ3FgPrE0C:code`,
      };
    }
    return farazProvider({ apiKey: farazKey, lineNumber: env.FARAZ_LINE_NUMBER?.trim() || FARAZ_DEFAULT_LINE, templates });
  }

  const smsIrKey = env.SMSIR_API_KEY;
  if (smsIrKey) {
    const templates: SmsIrConfig["templates"] = {};
    for (const kind of KINDS) {
      const name = templateEnvName(kind, "SMSIR");
      const value = env[name];
      if (!value) continue;
      templates[kind] = parseSmsIrTemplate(value) ?? {
        error: `${name} must look like <templateId>:<ParamName>, e.g. 123456:Code`,
      };
    }
    return smsIrProvider({ apiKey: smsIrKey, templates });
  }

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
