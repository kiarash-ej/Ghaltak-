import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatToman } from "@/lib/format";

// The seller's view of an order's online payment attempts (B6): what the
// gateway did with each, and which verified payments need the seller.

export type OnlineAttemptView = {
  id: string;
  amount: number;
  status: "PENDING" | "VERIFIED" | "FAILED" | "CANCELED";
  failureReason: string | null;
  failureDetail: string | null;
  refId: string | null;
  cardPanMasked: string | null;
  createdAt: Date;
  verifiedAt: Date | null;
};

const STATUS: Record<OnlineAttemptView["status"], { text: string; variant: "success" | "warning" | "danger" | "neutral" }> = {
  PENDING: { text: "در حال پرداخت", variant: "warning" },
  VERIFIED: { text: "پرداخت‌شده", variant: "success" },
  FAILED: { text: "ناموفق", variant: "danger" },
  CANCELED: { text: "لغو توسط مشتری", variant: "neutral" },
};

/** A verified payment that needs the seller, by its failureDetail (online-payment.ts). */
function reviewNote(a: OnlineAttemptView): string | null {
  if (a.status !== "VERIFIED" || !a.failureDetail) return null;
  if (a.failureDetail === "NOT_APPLIED") {
    return "درگاه این پرداخت را تأیید کرده، اما هنوز روی سفارش ثبت نشده است (مثلاً سفارش هم‌زمان تغییر کرد). اگر مشتری صفحه‌اش را تازه کند خودکار ثبت می‌شود؛ وگرنه پرداخت را دستی تأیید کنید.";
  }
  if (a.failureDetail === "ORDER_AMOUNT_CHANGED") {
    return "مبلغ به حساب شما آمد، اما مبلغ سفارش در این فاصله تغییر کرده بود. سفارش خودکار پرداخت‌شده نشد: مبلغ را بررسی و در صورت نیاز پرداخت را دستی تأیید یا مابه‌التفاوت را برگردانید.";
  }
  if (a.failureDetail.startsWith("ORDER_WAS_") && a.failureDetail !== "ORDER_WAS_CANCELED") {
    // PAID, PREPARING, SHIPPED, DELIVERED, RETURNED: the order had already been paid.
    return "این سفارش پیش از این پرداخت شده بود؛ این پرداخت اضافه است و باید به مشتری برگردانده شود.";
  }
  return "مبلغ به حساب شما آمد، اما سفارش دیگر منتظر پرداخت نبود (مثلاً لغو شده بود). سفارش خودکار باز نشد: پول را برگردانید یا سفارش را دستی دوباره ثبت کنید.";
}

export function OnlinePaymentsList({ attempts }: { attempts: OnlineAttemptView[] }) {
  return (
    <ul className="flex flex-col divide-y divide-neutral-100 text-sm">
      {attempts.map((a) => {
        const note = reviewNote(a);
        return (
          <li key={a.id} className="flex flex-col gap-1 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={STATUS[a.status].variant}>{STATUS[a.status].text}</Badge>
              <span>{formatToman(a.amount)}</span>
              <span className="text-neutral-500">· {formatDateTime(a.verifiedAt ?? a.createdAt)}</span>
            </div>
            {a.refId && (
              <div className="text-neutral-600">
                کد پیگیری درگاه: <span dir="ltr" className="font-mono">{a.refId}</span>
                {a.cardPanMasked && (
                  <>
                    {" "}· کارت <span dir="ltr" className="font-mono">{a.cardPanMasked}</span>
                  </>
                )}
              </div>
            )}
            {a.status === "FAILED" && a.failureReason === "AMOUNT_MISMATCH" && (
              <div className="text-red-700">درگاه مبلغ را با مبلغ ثبت‌شده یکی ندانست؛ پرداخت تأیید نشد.</div>
            )}
            {note && (
              <p role="alert" className="rounded-lg bg-red-50 p-2 text-red-800">
                {note}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
