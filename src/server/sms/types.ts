import type { SmsKind } from "@/generated/prisma/enums";

// Contract for the SMS service (docs/phase2/README.md, cross-track contracts).
// The real sendSms (A8) and its stub share these types.

export type SendSmsInput = {
  /** null for platform messages without a store, e.g. a login code. */
  sellerId: string | null;
  /** Normalized "09xxxxxxxxx". */
  to: string;
  kind: SmsKind;
  /** Values for the SMS template, in order. */
  tokens: string[];
  /**
   * Order messages are sent at most once per (orderId, kind): the real
   * sendSms claims a PENDING SmsMessage row first and sends only if it won
   * (see the SmsMessage model). A second call returns status "DUPLICATE".
   */
  orderId?: string | null;
};

export type SendSmsResult =
  | { ok: true; status: "SENT" | "DEV" | "DUPLICATE" }
  | { ok: false; reason: "PROVIDER_ERROR" | "QUOTA" };

/**
 * Rules for callers:
 * - Call AFTER the database transaction commits, never inside it: a sent SMS
 *   can't be taken back if the transaction rolls back.
 * - Never throws. A failed SMS must not break an order.
 */
export type SendSms = (input: SendSmsInput) => Promise<SendSmsResult>;
