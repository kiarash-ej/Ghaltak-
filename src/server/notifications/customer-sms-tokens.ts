// What each customer SMS says (Phase 2, B7). Pure, no database.
//
// Kavenegar sends a pre-approved TEMPLATE per kind (KAVENEGAR_TEMPLATE_<KIND>)
// with up to 3 values (token, token2, token3), each at most 100 characters;
// sendSms turns spaces into a zero-width non-joiner. The template texts are
// registered by Track C (C3) and must use the values in this order:
//
//   ORDER_PLACED      token=code  token2=link
//     e.g. «سفارش %token% ثبت شد. پیگیری و پرداخت: %token2%»
//   ORDER_PAID        token=code  token2=link
//     e.g. «پرداخت سفارش %token% تأیید شد. پیگیری: %token2%»
//   ORDER_SHIPPED     token=code  token2=tracking code (or «ندارد»)  token3=link
//     e.g. «سفارش %token% ارسال شد. کد رهگیری: %token2%. جزئیات: %token3%»
//   PAYMENT_REMINDER  token=code  token2=link
//     e.g. «سفارش %token% هنوز پرداخت نشده و فردا لغو می‌شود. پرداخت: %token2%»

export type CustomerSmsKind = "ORDER_PLACED" | "ORDER_PAID" | "ORDER_SHIPPED" | "PAYMENT_REMINDER";

export type CustomerSmsData = {
  orderCode: string;
  /** The customer's own order page, /buy/order/<publicToken>. */
  orderUrl: string;
  trackingCode?: string | null;
};

const MAX_TOKEN = 100;

function token(value: string): string {
  const clean = value.trim();
  return clean.length > MAX_TOKEN ? clean.slice(0, MAX_TOKEN) : clean;
}

export function customerSmsTokens(kind: CustomerSmsKind, data: CustomerSmsData): string[] {
  const code = token(data.orderCode);
  const link = token(data.orderUrl);
  switch (kind) {
    case "ORDER_PLACED":
    case "ORDER_PAID":
    case "PAYMENT_REMINDER":
      return [code, link];
    case "ORDER_SHIPPED":
      return [code, token(data.trackingCode || "ندارد"), link];
  }
}

/** Which Seller switch controls each kind. The reminder follows «ثبت سفارش». */
export const SMS_SWITCH: Record<CustomerSmsKind, "smsOnOrderPlaced" | "smsOnPaid" | "smsOnShipped"> = {
  ORDER_PLACED: "smsOnOrderPlaced",
  PAYMENT_REMINDER: "smsOnOrderPlaced",
  ORDER_PAID: "smsOnPaid",
  ORDER_SHIPPED: "smsOnShipped",
};

export const SMS_KIND_LABELS: Record<string, string> = {
  ORDER_PLACED: "ثبت سفارش",
  ORDER_PAID: "تأیید پرداخت",
  ORDER_SHIPPED: "ارسال",
  PAYMENT_REMINDER: "یادآوری پرداخت",
};
