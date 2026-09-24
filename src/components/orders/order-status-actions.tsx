"use client";

import { useActionState } from "react";
import type { OrderStatus } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { changeOrderStatusAction, type StatusChangeState } from "@/server/orders/actions";
import { STATUS_LABELS, nextStatuses, restoresStock } from "@/server/orders/status";

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
  const options = nextStatuses(status);

  if (options.length === 0) {
    return <p className="text-sm text-neutral-500">این سفارش بسته شده است.</p>;
  }

  return (
    <form
      action={action}
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const to = submitter?.value as OrderStatus | undefined;
        if (to && restoresStock(to) && !confirm(`سفارش «${STATUS_LABELS[to]}» شود؟ کالاها به موجودی برمی‌گردند.`)) {
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
            variant={restoresStock(to) ? "destructive" : "default"}
            disabled={pending}
          >
            {STATUS_LABELS[to]}
          </Button>
        ))}
      </div>
      {state?.message && (
        <p role="alert" className="text-sm text-red-600">
          {state.message}
        </p>
      )}
    </form>
  );
}
