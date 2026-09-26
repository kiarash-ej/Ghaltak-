import { prisma } from "@/lib/prisma";
import { maskMobile, type SmsProvider } from "./providers";
import type { SendSmsInput, SendSmsResult } from "./types";
import { errorSummary } from "@/lib/error-summary";

// The SMS service behind sendSms (A8). Every message is recorded in
// SmsMessage; order messages go out at most once per (orderId, kind).
// Not server-only so tests can build it with a fake provider; the entry point
// (./send.ts) is server-only.

/** Sends per (orderId, kind), counting the first. After that, retries stop. */
export const MAX_SEND_ATTEMPTS = 3;
/**
 * A PENDING claim older than this was left by a crash (a send takes at most
 * the provider's 10 second timeout), so it may be claimed again.
 */
export const STALE_CLAIM_MS = 5 * 60 * 1000;

type Claim = { kind: "claimed"; id: string } | { kind: "duplicate" } | { kind: "gave-up" };

export type SmsServiceOptions = {
  provider: SmsProvider;
  now?: () => Date;
  log?: (message: string, err?: unknown) => void;
};

export function createSmsService({
  provider,
  now = () => new Date(),
  log = (message, err) => console.error(message, err ?? ""),
}: SmsServiceOptions) {
  /** Claims the right to send: a new row, or a failed/stale order message to retry. */
  async function claim(input: SendSmsInput): Promise<Claim> {
    const row = {
      sellerId: input.sellerId,
      to: input.to,
      kind: input.kind,
      status: "PENDING" as const,
      attempts: 1,
    };

    if (!input.orderId) {
      const created = await prisma.smsMessage.create({ data: row, select: { id: true } });
      return { kind: "claimed", id: created.id };
    }

    const key = { orderId: input.orderId, kind: input.kind };
    // INSERT ... ON CONFLICT DO NOTHING: of several simultaneous calls, one wins.
    const inserted = await prisma.smsMessage.createMany({
      data: [{ ...row, orderId: input.orderId }],
      skipDuplicates: true,
    });
    if (inserted.count === 0) {
      // Retry a failed send, or take over a claim left behind by a crash. The
      // conditional update lets only one caller win this too.
      const retried = await prisma.smsMessage.updateMany({
        where: {
          ...key,
          attempts: { lt: MAX_SEND_ATTEMPTS },
          OR: [
            { status: "FAILED" },
            { status: "PENDING", updatedAt: { lt: new Date(now().getTime() - STALE_CLAIM_MS) } },
          ],
        },
        data: { status: "PENDING", attempts: { increment: 1 } },
      });
      if (retried.count === 0) {
        const existing = await prisma.smsMessage.findUnique({
          where: { orderId_kind: key },
          select: { status: true },
        });
        return existing?.status === "FAILED" ? { kind: "gave-up" } : { kind: "duplicate" };
      }
    }
    const claimed = await prisma.smsMessage.findUniqueOrThrow({
      where: { orderId_kind: key },
      select: { id: true },
    });
    return { kind: "claimed", id: claimed.id };
  }

  async function send(input: SendSmsInput): Promise<SendSmsResult> {
    const what = `${input.kind} to ${maskMobile(input.to)}`;
    try {
      const claimed = await claim(input);
      if (claimed.kind === "duplicate") return { ok: true, status: "DUPLICATE" };
      if (claimed.kind === "gave-up") return { ok: false, reason: "PROVIDER_ERROR" };

      const result = await provider
        .send({ to: input.to, kind: input.kind, tokens: input.tokens })
        .catch((err: unknown) => ({ ok: false as const, error: String((err as Error)?.name ?? err) }));

      if (!result.ok) {
        await prisma.smsMessage.update({ where: { id: claimed.id }, data: { status: "FAILED" } });
        log(`[sms] ${what} failed: ${result.error}`);
        return { ok: false, reason: "PROVIDER_ERROR" };
      }
      const status = provider.mode === "DEV" ? "DEV" : "SENT";
      await prisma.smsMessage.update({
        where: { id: claimed.id },
        data: { status, providerId: result.providerId },
      });
      return { ok: true, status };
    } catch (err) {
      // Only the error's kind: a failed write quotes the row (mobile, tokens,
      // possibly a login code).
      log(`[sms] ${what} could not be recorded or sent`, errorSummary(err));
      return { ok: false, reason: "ERROR" };
    }
  }

  return { send };
}
