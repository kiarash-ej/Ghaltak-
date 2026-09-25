import type { SmsKind } from "@/generated/prisma/enums";

// Contract for the SMS service (docs/phase2/README.md, cross-track contracts).
// Implemented by src/server/sms/send.ts (A8).

export type SendSmsInput = {
  /** null for platform messages without a store, e.g. a login code. */
  sellerId: string | null;
  /** Normalized "09xxxxxxxxx". */
  to: string;
  kind: SmsKind;
  /**
   * Values for the SMS template, in order (Kavenegar's token, token2, token3):
   * 1 to 3 values of at most 100 characters. Spaces are not allowed by the
   * provider, so they are sent as a zero-width non-joiner (نیم‌فاصله).
   */
  tokens: string[];
  /**
   * Order messages are sent at most once per (orderId, kind): sendSms claims a
   * PENDING SmsMessage row first and sends only if it won (see the SmsMessage
   * model). A second call returns status "DUPLICATE", unless the first send
   * failed, in which case it is retried (at most 3 attempts in total).
   */
  orderId?: string | null;
};

export type SendSmsResult =
  | { ok: true; status: "SENT" | "DEV" | "DUPLICATE" }
  | {
      ok: false;
      /**
       * PROVIDER_ERROR: the provider refused or couldn't be reached.
       * QUOTA: reserved for plan limits (A9); sendSms itself doesn't check them.
       * ERROR: anything else, e.g. the database; logged on the server.
       */
      reason: "PROVIDER_ERROR" | "QUOTA" | "ERROR";
    };

/**
 * Rules for callers:
 * - Call AFTER the database transaction commits, never inside it: a sent SMS
 *   can't be taken back if the transaction rolls back.
 * - Never throws. A failed SMS must not break an order.
 */
export type SendSms = (input: SendSmsInput) => Promise<SendSmsResult>;
