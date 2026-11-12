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

// When each one goes out. An SMS costs money, so it is only sent to a customer
// who is NOT already looking at the news on their order page:
//
//   ORDER_PLACED      orders the seller enters by hand. Not purchase-link
//                     orders: that customer lands on the order page itself.
//   ORDER_PAID        payments the seller confirms (by hand or from a receipt).
//                     Not online payments: the gateway returns the customer
//                     to the order page, which says it is paid.
//   ORDER_SHIPPED     always: the customer left long ago.
//   PAYMENT_REMINDER  unpaid purchase-link orders, a day before they expire.
//                     Its link is also how a link customer finds the page again.

export type SmsSwitch = "smsOnOrderPlaced" | "smsOnPaid" | "smsOnShipped" | "smsOnPaymentReminder";

/** Which Seller switch controls each kind. */
export const SMS_SWITCH: Record<CustomerSmsKind, SmsSwitch> = {
  ORDER_PLACED: "smsOnOrderPlaced",
  PAYMENT_REMINDER: "smsOnPaymentReminder",
  ORDER_PAID: "smsOnPaid",
  ORDER_SHIPPED: "smsOnShipped",
};

export const SMS_KIND_LABELS: Record<string, string> = {
  ORDER_PLACED: "ثبت سفارش",
  ORDER_PAID: "تأیید پرداخت",
  ORDER_SHIPPED: "ارسال",
  PAYMENT_REMINDER: "یادآوری پرداخت",
};
