import type { SmsKind } from "@/generated/prisma/enums";

// Public reference for sellers and SMS providers. Keep every supported kind
// documented, including messages enabled only when the relevant service runs.
export const SMS_USES: { kind: SmsKind; title: string; text: string }[] = [
  { kind: "LOGIN_OTP", title: "کد ورود", text: "کد تأیید شش‌رقمی برای ورود فروشنده و همکاران به حساب غلتک." },
  { kind: "ORDER_PLACED", title: "ثبت سفارش", text: "کد سفارش و لینک صفحهٔ پیگیری و پرداخت برای مشتری، وقتی فروشنده سفارش را خودش ثبت می‌کند. مشتری لینک خرید همان لحظه صفحهٔ سفارش را می‌بیند و این پیامک را نمی‌گیرد." },
  { kind: "ORDER_PAID", title: "تأیید پرداخت", text: "اطلاع به مشتری پس از این‌که فروشنده پرداخت سفارش را تأیید می‌کند. پس از پرداخت آنلاین فرستاده نمی‌شود، چون مشتری نتیجه را در صفحهٔ سفارش می‌بیند." },
  { kind: "ORDER_SHIPPED", title: "ارسال سفارش", text: "اطلاع به مشتری پس از ثبت ارسال، همراه با کد رهگیری مرسوله." },
  { kind: "PAYMENT_REMINDER", title: "یادآوری پرداخت", text: "یادآوری برای مشتریانی که سفارش لینک خریدشان هنوز پرداخت نشده است، یک روز پیش از لغو خودکار." },
  { kind: "MEMBER_INVITE", title: "دعوت همکار", text: "اطلاع به همکاری که به فروشگاه دعوت شده است." },
  { kind: "SUBSCRIPTION_REMINDER", title: "یادآوری تمدید اشتراک", text: "دیگر فرستاده نمی‌شود: یادآوری تمدید اشتراک حالا در اعلان‌های داخل برنامه می‌آید." },
];
