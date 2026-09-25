"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { SubscriptionPaymentState } from "@/server/billing/actions";

/** «پرداخت» for one plan on /settings/billing. The price comes from the server. */
export function PlanPayButton({
  action: start,
  plan,
  label,
  variant = "default",
}: {
  action: (state: SubscriptionPaymentState, formData: FormData) => Promise<SubscriptionPaymentState>;
  plan: string;
  label: string;
  variant?: "default" | "outline";
}) {
  const [state, action, pending] = useActionState(start, undefined);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="plan" value={plan} />
      <Button type="submit" variant={variant} disabled={pending} className="w-full">
        {pending ? "در حال انتقال به درگاه…" : label}
      </Button>
      {state?.message && (
        <p role="alert" className="text-sm text-red-600">
          {state.message}
        </p>
      )}
    </form>
  );
}
