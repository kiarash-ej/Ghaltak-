"use client";

import { useActionState, useState } from "react";
import type { ExpenseCategory } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, EXPENSE_CATEGORIES } from "@/server/finance/expense-categories";
import type { ExpenseFormState } from "@/server/finance/expense-form";

// Add or edit an expense (spec §6.4): amount, category as chips, a Jalali date
// (today by default), a note, and for a new one «هر ماه تکرار شود». A monthly
// repeat is edited with the same form, its day of the month in place of the
// date. The fields are controlled, so a failed save keeps what was typed.

type Values = { amount: string; category: ExpenseCategory; date: string; day: string; note: string; repeat: boolean };

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p role="alert" className="text-sm text-danger">
      {messages.join(" ")}
    </p>
  );
}

export function ExpenseForm({
  action,
  initial,
  mode,
  idPrefix,
  onSaved,
}: {
  action: (state: ExpenseFormState, formData: FormData) => Promise<ExpenseFormState>;
  initial: { amount?: number; category?: ExpenseCategory; date?: string; day?: number; note?: string | null };
  mode: "add" | "edit" | "repeat";
  idPrefix: string;
  onSaved?: () => void;
}) {
  const start: Values = {
    amount: initial.amount !== undefined ? String(initial.amount) : "",
    category: initial.category ?? "ADS",
    date: initial.date ?? "",
    day: initial.day !== undefined ? String(initial.day) : "",
    note: initial.note ?? "",
    repeat: false,
  };
  const [values, setValues] = useState(start);
  const set = (patch: Partial<Values>) => setValues((v) => ({ ...v, ...patch }));
  const [state, formAction, pending] = useActionState(async (prev: ExpenseFormState, formData: FormData) => {
    const result = await action(prev, formData);
    if (result?.ok) {
      if (mode === "add") setValues({ ...start, category: values.category });
      onSaved?.();
    }
    return result;
  }, undefined);
  const errors = state?.errors;
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
        <div className="flex flex-col gap-2">
          <Label htmlFor={id("amount")}>مبلغ (تومان)</Label>
          <Input
            id={id("amount")}
            name="amount"
            inputMode="numeric"
            dir="ltr"
            className="text-end text-base font-bold"
            placeholder="۱٬۸۰۰٬۰۰۰"
            value={values.amount}
            onChange={(e) => set({ amount: e.target.value })}
            aria-invalid={errors?.amount ? true : undefined}
            required
          />
          <FieldError messages={errors?.amount} />
        </div>
        {mode === "repeat" ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor={id("day")}>روز ماه</Label>
            <Input
              id={id("day")}
              name="day"
              inputMode="numeric"
              dir="ltr"
              className="text-end"
              value={values.day}
              onChange={(e) => set({ day: e.target.value })}
              aria-invalid={errors?.day ? true : undefined}
              required
            />
            <FieldError messages={errors?.day} />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Label htmlFor={id("date")}>تاریخ</Label>
            <Input
              id={id("date")}
              name="date"
              inputMode="numeric"
              dir="ltr"
              className="text-end"
              value={values.date}
              onChange={(e) => set({ date: e.target.value })}
              aria-invalid={errors?.date ? true : undefined}
              required
            />
            <FieldError messages={errors?.date} />
          </div>
        )}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">نوع هزینه</legend>
        <div className="flex flex-wrap gap-2">
          {EXPENSE_CATEGORIES.map((c) => (
            <label key={c} className="cursor-pointer">
              <input
                type="radio"
                name="category"
                value={c}
                checked={values.category === c}
                onChange={() => set({ category: c })}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "block rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-focus",
                  values.category === c ? "border-transparent bg-action text-action-ink" : "border-line text-ink-soft hover:border-line-strong hover:text-ink",
                )}
              >
                {CATEGORY_LABELS[c]}
              </span>
            </label>
          ))}
        </div>
        <FieldError messages={errors?.category} />
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor={id("note")}>توضیح (اختیاری)</Label>
        <Input id={id("note")} name="note" placeholder="مثلاً تبلیغ استوری پیج" value={values.note} onChange={(e) => set({ note: e.target.value })} />
        <FieldError messages={errors?.note} />
      </div>

      {mode === "add" && (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-raised-2/40 p-3 text-sm">
          <input
            type="checkbox"
            name="repeat"
            checked={values.repeat}
            onChange={(e) => set({ repeat: e.target.checked })}
            className="mt-0.5 size-4 accent-[var(--gk-brand-2)]"
          />
          <span className="flex flex-col gap-0.5">
            <span className="font-semibold">هر ماه تکرار شود</span>
            <span className="text-muted">مثل اجاره یا حقوق: هر ماه در همین روز خودکار ثبت می‌شود، از ماهِ همین تاریخ.</span>
          </span>
        </label>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "در حال ذخیره…" : mode === "add" ? "ثبت هزینه" : "ذخیره"}
        </Button>
        {state?.message && (
          <p role={state.ok ? "status" : "alert"} className={cn("text-sm", state.ok ? "text-success" : "text-danger")}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
