import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { SMS_KIND_LABELS } from "@/server/notifications/customer-sms-tokens";

// Customer SMS sent for one order (B7), on the seller's order page.

export type OrderSmsView = {
  id: string;
  kind: string;
  status: "PENDING" | "SENT" | "FAILED" | "DEV";
  attempts: number;
  createdAt: Date;
};

const STATUS: Record<OrderSmsView["status"], { text: string; variant: "success" | "warning" | "danger" | "neutral" }> = {
  SENT: { text: "ارسال شد", variant: "success" },
  DEV: { text: "آزمایشی (ارسال نشد)", variant: "neutral" },
  PENDING: { text: "در حال ارسال", variant: "warning" },
  FAILED: { text: "ناموفق", variant: "danger" },
};

export function OrderSmsList({ messages }: { messages: OrderSmsView[] }) {
  if (messages.length === 0) {
    return <p className="text-sm text-neutral-500">هنوز پیامکی برای این سفارش فرستاده نشده است.</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-neutral-100 text-sm">
      {messages.map((m) => (
        <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span>{SMS_KIND_LABELS[m.kind] ?? m.kind}</span>
          <span className="flex items-center gap-2">
            <Badge variant={STATUS[m.status].variant}>{STATUS[m.status].text}</Badge>
            {m.status === "FAILED" && m.attempts > 1 && (
              <span className="text-xs text-neutral-500">{m.attempts} تلاش</span>
            )}
            <span className="text-xs text-neutral-500">{formatDateTime(m.createdAt)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
