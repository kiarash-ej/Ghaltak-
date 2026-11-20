"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import * as z from "zod";
import { normalizeIranMobile, toEnglishDigits } from "@/lib/format";
import { clientIp, createRateLimiter } from "@/server/orders/rate-limit";
import { requestOtp, verifyOtp } from "@/server/otp";
import { createSession, deleteSession } from "@/server/session";

export type LoginState = {
  step: "mobile" | "code";
  mobile?: string;
  error?: string;
};

const ERRORS = {
  INVALID_MOBILE: "شمارهٔ موبایل معتبر نیست. آن را مثل ۰۹۱۲۱۲۳۴۵۶۷ وارد کنید.",
  COOLDOWN: "یک دقیقه صبر کنید و دوباره تلاش کنید.",
  TOO_MANY_REQUESTS: "برای این شماره بیش از حد مجاز کد درخواست شده است. کمی بعد دوباره تلاش کنید.",
  SMS_FAILED: "پیامک کد تأیید فرستاده نشد. دوباره تلاش کنید.",
  INVALID_CODE: "کد تأیید درست نیست. کد شش‌رقمی پیامک را دوباره بررسی کنید.",
  EXPIRED_CODE: "اعتبار این کد تمام شده است. با «تغییر شماره یا دریافت کد جدید» کد تازه بگیرید.",
  RATE_LIMITED: "از این شبکه درخواست‌های زیادی فرستاده شده است. چند دقیقهٔ دیگر دوباره تلاش کنید.",
  BUSY: "الان درخواست کد ورود زیاد است. چند دقیقهٔ دیگر دوباره تلاش کنید.",
  PLAN_ENDED: "اشتراک فروشگاه تمام شده است. به مالک فروشگاه بگویید آن را تمدید کند.",
} as const;

const codeSchema = z.string().regex(/^\d{6}$/);

// The login form is public, and every code request costs an SMS to a number
// the visitor chose. The per-number limits (otp.ts) don't stop one client
// walking through many numbers, so both steps are also limited per IP.
// Generous on purpose: many Iranian mobile users share an IP (carrier NAT).
// LOGIN_CODES_PER_IP changes the number (per 10 minutes); the end-to-end
// tests raise it, because every test logs in from the same address.
function codesPerIp(): number {
  const n = Number(process.env.LOGIN_CODES_PER_IP);
  return Number.isInteger(n) && n > 0 ? n : 10;
}
const codeRequestLimiter = createRateLimiter({ limit: codesPerIp(), windowMs: 10 * 60 * 1000 });
const codeGuessLimiter = createRateLimiter({ limit: codesPerIp() * 3, windowMs: 10 * 60 * 1000 });

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const step = formData.get("step");
  const mobile = normalizeIranMobile(String(formData.get("mobile") ?? ""));

  if (!mobile) {
    return { step: "mobile", error: ERRORS.INVALID_MOBILE };
  }

  const ip = clientIp(await headers());

  // Step 1: send the SMS code.
  if (step !== "code") {
    if (!codeRequestLimiter.hit(ip)) return { step: "mobile", mobile, error: ERRORS.RATE_LIMITED };
    const result = await requestOtp(mobile);
    if (!result.ok) {
      return { step: "mobile", mobile, error: ERRORS[result.error] };
    }
    return { step: "code", mobile };
  }

  // Step 2: verify the code and start a session.
  if (!codeGuessLimiter.hit(ip)) return { step: "code", mobile, error: ERRORS.RATE_LIMITED };
  const parsed = codeSchema.safeParse(
    toEnglishDigits(String(formData.get("code") ?? "")).trim(),
  );
  if (!parsed.success) {
    return { step: "code", mobile, error: ERRORS.INVALID_CODE };
  }

  const result = await verifyOtp(mobile, parsed.data);
  if (!result.ok) {
    return {
      step: "code",
      mobile,
      error: result.error === "EXPIRED" ? ERRORS.EXPIRED_CODE : ERRORS.INVALID_CODE,
    };
  }

  // Into the most recently used store the member may work in; with more than
  // one store, they can switch right away (A10).
  const { userId, stores } = result.account;
  for (const store of stores) {
    const started = await createSession(userId, store.sellerId);
    if (started.ok) redirect(stores.length > 1 ? "/select-store" : "/");
  }
  // Every store refused: an operator whose store's plan ended.
  return { step: "code", mobile, error: ERRORS.PLAN_ENDED };
}

export async function logoutAction() {
  await deleteSession();
  redirect("/login");
}
