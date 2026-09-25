import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { accountForLogin, type LoginAccount } from "./account";
import { sendSms } from "./sms/send";

const CODE_TTL_MS = 2 * 60 * 1000; // a code is valid for 2 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // at most one SMS per minute per number
const MAX_REQUESTS_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

function hashCode(mobile: string, code: string): string {
  const secret = process.env.SESSION_SECRET ?? "";
  return createHmac("sha256", secret).update(`${mobile}:${code}`).digest("hex");
}

export type RequestOtpResult =
  | { ok: true }
  | { ok: false; error: "COOLDOWN" | "TOO_MANY_REQUESTS" | "SMS_FAILED" };

export async function requestOtp(mobile: string): Promise<RequestOtpResult> {
  const now = Date.now();

  const recent = await prisma.otpCode.findMany({
    where: { mobile, createdAt: { gt: new Date(now - 60 * 60 * 1000) } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (recent.length >= MAX_REQUESTS_PER_HOUR) {
    return { ok: false, error: "TOO_MANY_REQUESTS" };
  }
  if (recent[0] && now - recent[0].createdAt.getTime() < RESEND_COOLDOWN_MS) {
    return { ok: false, error: "COOLDOWN" };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const record = await prisma.otpCode.create({
    data: {
      mobile,
      codeHash: hashCode(mobile, code),
      expiresAt: new Date(now + CODE_TTL_MS),
    },
  });

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
  if (record.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: "INVALID" };
  }

  const expected = Buffer.from(record.codeHash, "hex");
  const actual = Buffer.from(hashCode(mobile, code), "hex");
  const matches =
    expected.length === actual.length && timingSafeEqual(expected, actual);

  if (!matches) {
    await prisma.otpCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, error: "INVALID" };
  }

  // Mark consumed first so a code can never be used twice.
  const claimed = await prisma.otpCode.updateMany({
    where: { id: record.id, consumed: false },
    data: { consumed: true },
  });
  if (claimed.count === 0) return { ok: false, error: "INVALID" };

  return { ok: true, account: await accountForLogin(mobile) };
}
