"use client";

import { useActionState } from "react";
import type { OrderStatus } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { changeOrderStatusAction, type StatusChangeState } from "@/server/orders/actions";
import {
  STATUS_LABELS,
  detailsRequiredFor,
  nextStatuses,
  restoresStock,
} from "@/server/orders/status";

export function OrderStatusActions({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const [state, action, pending] = useActionState<StatusChangeState, FormData>(
    changeOrderStatusAction.bind(null, orderId),
    undefined,
  );
  if (nextStatuses(status).length === 0) {
    return <p className="text-sm text-muted">این سفارش بسته شده است.</p>;
  }
  // Moves that need details (payment) have their own form on the order page.
  const options = nextStatuses(status).filter((to) => !detailsRequiredFor(to));
  if (options.length === 0) return null;

  return (
    <form
      action={action}
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const to = submitter?.value as OrderStatus | undefined;
        if (to && restoresStock(to) && !confirm(`وضعیت سفارش به «${STATUS_LABELS[to]}» تغییر کند؟ کالاهای این سفارش به موجودی برمی‌گردند.`)) {
          e.preventDefault();
        }
      }}
    >
      <div className="flex flex-wrap gap-2">
        {options.map((to) => (
          <Button
            key={to}
            type="submit"
            name="to"
            value={to}
            size="sm"
            variant={restoresStock(to) ? "danger-outline" : "default"}
            disabled={pending}
          >
            {STATUS_LABELS[to]}
          </Button>
        ))}
      </div>
      {state?.message && (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}
    </form>
  );
}
