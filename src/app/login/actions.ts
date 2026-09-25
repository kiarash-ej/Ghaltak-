"use server";

import { redirect } from "next/navigation";
import * as z from "zod";
import { normalizeIranMobile, toEnglishDigits } from "@/lib/format";
import { requestOtp, verifyOtp } from "@/server/otp";
import { createSession, deleteSession } from "@/server/session";

export type LoginState = {
  step: "mobile" | "code";
  mobile?: string;
  error?: string;
};

const ERRORS = {
  INVALID_MOBILE: "شماره موبایل معتبر نیست. مثال: ۰۹۱۲۱۲۳۴۵۶۷",
  COOLDOWN: "لطفاً یک دقیقه صبر کنید و دوباره تلاش کنید.",
  TOO_MANY_REQUESTS: "تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.",
  SMS_FAILED: "ارسال پیامک ناموفق بود. دوباره تلاش کنید.",
  INVALID_CODE: "کد وارد شده اشتباه است.",
  EXPIRED_CODE: "کد منقضی شده است. کد جدید بگیرید.",
  PLAN_ENDED: "اشتراک فروشگاه تمام شده است. به مالک فروشگاه اطلاع دهید تا آن را تمدید کند.",
} as const;

const codeSchema = z.string().regex(/^\d{6}$/);

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const step = formData.get("step");
  const mobile = normalizeIranMobile(String(formData.get("mobile") ?? ""));

  if (!mobile) {
    return { step: "mobile", error: ERRORS.INVALID_MOBILE };
  }

  // Step 1: send the SMS code.
  if (step !== "code") {
    const result = await requestOtp(mobile);
    if (!result.ok) {
      return { step: "mobile", mobile, error: ERRORS[result.error] };
    }
    return { step: "code", mobile };
  }

  // Step 2: verify the code and start a session.
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
