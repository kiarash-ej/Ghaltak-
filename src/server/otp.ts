import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { accountForLogin, type LoginAccount } from "./account";
import { sendSms } from "./sms/send";

const CODE_TTL_MS = 2 * 60 * 1000; // a code is valid for 2 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // at most one SMS per minute per number
const MAX_REQUESTS_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;
/**
 * Login codes the whole platform sends per hour (LOGIN_SMS_PER_HOUR). The
 * per-number limits above don't stop someone asking for codes for thousands of
 * different numbers, and the per-IP limit in the login action doesn't stop
 * rotating IPs; this ceiling is what keeps the SMS credit from being drained.
 * Set it well above a real busy hour.
 */
const DEFAULT_GLOBAL_PER_HOUR = 300;

export function globalOtpLimit(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.LOGIN_SMS_PER_HOUR);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_GLOBAL_PER_HOUR;
}

let lastCeilingLog = 0;

function hashCode(mobile: string, code: string): string {
  const secret = process.env.SESSION_SECRET ?? "";
  return createHmac("sha256", secret).update(`${mobile}:${code}`).digest("hex");
}

export type RequestOtpResult =
  | { ok: true }
  | { ok: false; error: "COOLDOWN" | "TOO_MANY_REQUESTS" | "BUSY" | "SMS_FAILED" };

export async function requestOtp(
  mobile: string,
  opts: { globalLimit?: number } = {},
): Promise<RequestOtpResult> {
  const now = Date.now();
  const hourAgo = new Date(now - 60 * 60 * 1000);

  const sentLastHour = await prisma.smsMessage.count({
    where: { sellerId: null, kind: "LOGIN_OTP", createdAt: { gt: hourAgo } },
  });
  if (sentLastHour >= (opts.globalLimit ?? globalOtpLimit())) {
    if (now - lastCeilingLog > 60 * 1000) {
      lastCeilingLog = now;
      console.error(`[otp] hourly login SMS ceiling reached (${sentLastHour}); refusing new codes`);
    }
    return { ok: false, error: "BUSY" };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  // Check and insert under a per-number lock: requests for one number sent at
  // the same moment take turns, so they can't all pass the cooldown together.
  const claimed = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`otp:${mobile}`}))`;
    const recent = await tx.otpCode.findMany({
      where: { mobile, createdAt: { gt: hourAgo } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (recent.length >= MAX_REQUESTS_PER_HOUR) return { error: "TOO_MANY_REQUESTS" as const };
    if (recent[0] && now - recent[0].createdAt.getTime() < RESEND_COOLDOWN_MS) return { error: "COOLDOWN" as const };
    return tx.otpCode.create({
      data: { mobile, codeHash: hashCode(mobile, code), expiresAt: new Date(now + CODE_TTL_MS) },
      select: { id: true },
    });
  });
  if ("error" in claimed) return { ok: false, error: claimed.error };
  const record = claimed;

  // sendSms never throws; it records the message (never the code) and logs failures.
  const sent = await sendSms({ sellerId: null, to: mobile, kind: "LOGIN_OTP", tokens: [code] });
  if (!sent.ok) {
    await prisma.otpCode.delete({ where: { id: record.id } });
    return { ok: false, error: "SMS_FAILED" };
  }
  return { ok: true };
}

export type VerifyOtpResult =
  | { ok: true; account: LoginAccount }
  | { ok: false; error: "INVALID" | "EXPIRED" };

/** Verifies the code and returns the seller, creating the account on first login. */
export async function verifyOtp(
  mobile: string,
  code: string,
): Promise<VerifyOtpResult> {
  const record = await prisma.otpCode.findFirst({
    where: { mobile, consumed: false },
    orderBy: { createdAt: "desc" },
  });

  if (!record || record.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "EXPIRED" };
  }

  // Take one of the code's tries BEFORE comparing, in a single conditional
  // update: requests sent at the same moment can't all read "0 tries used"
  // and each get a guess, so a code gets MAX_ATTEMPTS guesses in total.
  const counted = await prisma.otpCode.updateMany({
    where: { id: record.id, consumed: false, attempts: { lt: MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (counted.count === 0) return { ok: false, error: "INVALID" };

  const expected = Buffer.from(record.codeHash, "hex");
  const actual = Buffer.from(hashCode(mobile, code), "hex");
  const matches =
    expected.length === actual.length && timingSafeEqual(expected, actual);

  if (!matches) return { ok: false, error: "INVALID" };

  // Mark consumed first so a code can never be used twice.
  const claimed = await prisma.otpCode.updateMany({
    where: { id: record.id, consumed: false },
    data: { consumed: true },
  });
  if (claimed.count === 0) return { ok: false, error: "INVALID" };

  return { ok: true, account: await accountForLogin(mobile) };
}
