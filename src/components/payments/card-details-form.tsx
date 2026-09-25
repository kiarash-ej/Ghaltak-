"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CardDetailsFormState } from "@/server/payments/card-actions";
import type { CardDetailsForSettings } from "@/server/payments/card-store";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p role="alert" className="text-sm text-red-600">
      {messages[0]}
    </p>
  );
}

export function CardDetailsForm({
  action: save,
  initial,
}: {
  action: (state: CardDetailsFormState, formData: FormData) => Promise<CardDetailsFormState>;
  initial: CardDetailsForSettings;
}) {
  const [state, action, pending] = useActionState(save, undefined);
  const errors = state?.errors ?? {};
  const current = state?.saved ?? initial;

  const [cardNumber, setCardNumber] = useState("");
  const [sheba, setSheba] = useState("");
  const [holder, setHolder] = useState(initial.cardHolder ?? "");
  const [removeCard, setRemoveCard] = useState(false);
  const [removeSheba, setRemoveSheba] = useState(false);

  // After a successful save the full numbers are gone from the page for good.
  // (Reset while rendering when a new save arrives, per React's "adjusting
  // state when a prop changes" pattern, instead of in an effect.)
  const [seenSavedAt, setSeenSavedAt] = useState(state?.savedAt);
  if (state?.savedAt !== seenSavedAt) {
    setSeenSavedAt(state?.savedAt);
    setCardNumber("");
    setSheba("");
    setRemoveCard(false);
    setRemoveSheba(false);
  }

  return (
    <form action={action} className="flex max-w-lg flex-col gap-5">
      <p className="text-sm text-neutral-600">
        این اطلاعات فقط روی صفحهٔ سفارش همان مشتری نمایش داده می‌شود تا مبلغ را کارت‌به‌کارت واریز کند. شمارهٔ
        کارت و شبا رمزشده نگه داشته می‌شوند و بعد از ذخیره فقط چهار رقم آخرشان نمایش داده می‌شود.
      </p>

      <div className="flex flex-col gap-2">
        <Label htmlFor="cardNumber">شمارهٔ کارت</Label>
        <Input
          id="cardNumber"
          name="cardNumber"
          inputMode="numeric"
          autoComplete="off"
          dir="ltr"
          placeholder={current.cardMasked ? `ذخیره‌شده: ${current.cardMasked}` : "6037 9912 3456 7893"}
          value={cardNumber}
          disabled={removeCard}
          onChange={(e) => setCardNumber(e.target.value)}
        />
        {current.cardMasked && (
          <p className="text-xs text-neutral-500">
            کارت ذخیره‌شده: <span dir="ltr">{current.cardMasked}</span>. برای تغییر، شمارهٔ جدید را وارد کنید.
          </p>
        )}
        {current.cardMasked && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="removeCard"
              checked={removeCard}
              onChange={(e) => setRemoveCard(e.target.checked)}
            />
            حذف شمارهٔ کارت
          </label>
        )}
        <FieldError messages={errors.cardNumber} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="cardHolder">نام صاحب کارت</Label>
        <Input
          id="cardHolder"
          name="cardHolder"
          maxLength={60}
          value={holder}
          onChange={(e) => setHolder(e.target.value)}
        />
        <p className="text-xs text-neutral-500">همان نامی که مشتری هنگام انتقال وجه در بانک می‌بیند.</p>
        <FieldError messages={errors.cardHolder} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="sheba">شمارهٔ شبا (اختیاری)</Label>
        <Input
          id="sheba"
          name="sheba"
          autoComplete="off"
          dir="ltr"
          placeholder={current.shebaMasked ? `ذخیره‌شده: ${current.shebaMasked}` : "IR82 0540 1026 8002 0817 9090 02"}
          value={sheba}
          disabled={removeSheba}
          onChange={(e) => setSheba(e.target.value)}
        />
        {current.shebaMasked && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="removeSheba"
              checked={removeSheba}
              onChange={(e) => setRemoveSheba(e.target.checked)}
            />
            حذف شمارهٔ شبا
          </label>
        )}
        <FieldError messages={errors.sheba} />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "در حال ذخیره…" : "ذخیرهٔ اطلاعات کارت"}
        </Button>
        {state?.savedAt && !pending && <span className="text-sm text-green-700">ذخیره شد.</span>}
      </div>
      {state?.message && (
        <p role="alert" className="text-sm text-red-600">
          {state.message}
        </p>
      )}
    </form>
  );
}
