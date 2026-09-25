"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { OnlinePaymentState } from "@/server/payments/online-actions";

/** Public: "pay online" on the customer's order page. The server does the rest. */
export function OnlinePayButton({
  action: start,
  amountText,
}: {
  action: (state: OnlinePaymentState, formData: FormData) => Promise<OnlinePaymentState>;
  amountText: string;
}) {
  const [state, action, pending] = useActionState(start, undefined);
  return (
    <form action={action} className="flex flex-col gap-2">
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "در حال انتقال به درگاه…" : `پرداخت آنلاین ${amountText}`}
      </Button>
      {state?.message && (
        <p role="alert" className="text-sm text-red-600">
          {state.message}
        </p>
      )}
    </form>
  );
}
