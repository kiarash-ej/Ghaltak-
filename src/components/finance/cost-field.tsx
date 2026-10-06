"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CostFormState } from "@/server/finance/cost-actions";

/**
 * The cost price right where it is missing («سود محصولات», spec §6.4). It
 * saves the product's cost and, unless unticked, gives it to the past sales
 * that had none, so their profit can be worked out.
 */
export function CostField({
  action,
  productName,
  initial,
}: {
  action: (state: CostFormState, formData: FormData) => Promise<CostFormState>;
  productName: string;
  initial: number | null;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [cost, setCost] = useState(initial !== null ? String(initial) : "");
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          name="cost"
          aria-label={`قیمت خرید ${productName} (تومان)`}
          placeholder="قیمت خرید (تومان)"
          inputMode="numeric"
          dir="ltr"
          className="h-9 w-40 text-end"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          required
        />
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "در حال ذخیره…" : "ذخیرهٔ قیمت خرید"}
        </Button>
      </div>
      <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-ink-soft">
        <input type="checkbox" name="applyToPast" defaultChecked className="size-3.5 accent-[var(--gk-brand-2)]" />
        برای فروش‌های قبلیِ بدون قیمت خرید هم استفاده شود
      </label>
      {state?.error && (
        <p role="alert" className="text-xs text-danger">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="text-xs text-success">
          ذخیره شد؛ از فروش‌های بعدی با این قیمت حساب می‌شود.
        </p>
      )}
    </form>
  );
}
