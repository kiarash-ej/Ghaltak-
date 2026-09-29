import type { SmsKind } from "@/generated/prisma/enums";

// Public reference for sellers and SMS providers. Keep every supported kind
// documented, including messages enabled only when the relevant service runs.
export const SMS_USES: { kind: SmsKind; title: string; text: string }[] = [
  { kind: "LOGIN_OTP", title: "کد ورود", text: "کد تأیید شش‌رقمی برای ورود فروشنده و همکاران به حساب غلتک." },
  { kind: "ORDER_PLACED", title: "ثبت سفارش", text: "کد سفارش و لینک صفحهٔ پیگیری و پرداخت برای مشتری، پس از ثبت سفارش." },
  { kind: "ORDER_PAID", title: "تأیید پرداخت", text: "اطلاع به مشتری پس از تأیید پرداخت سفارش." },
  { kind: "ORDER_SHIPPED", title: "ارسال سفارش", text: "اطلاع به مشتری پس از ثبت ارسال، همراه با کد رهگیری مرسوله." },
  { kind: "PAYMENT_REMINDER", title: "یادآوری پرداخت", text: "یادآوری برای مشتریانی که سفارششان هنوز پرداخت نشده است؛ فعال بودن آن به تنظیم «ثبت سفارش» بستگی دارد." },
  { kind: "MEMBER_INVITE", title: "دعوت همکار", text: "اطلاع به همکاری که به فروشگاه دعوت شده است." },
  { kind: "SUBSCRIPTION_REMINDER", title: "یادآوری تمدید اشتراک", text: "در صورت فعال بودن اشتراک‌ها، یادآوری به فروشنده سه روز پیش از پایان دورهٔ آزمایشی یا اشتراک." },
];
