"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { SmsSettingsState } from "@/server/notifications/settings-actions";

type Switches = { smsOnOrderPlaced: boolean; smsOnPaid: boolean; smsOnShipped: boolean };

const ROWS: { name: keyof Switches; label: string; hint: string }[] = [
  { name: "smsOnOrderPlaced", label: "ثبت سفارش", hint: "کد سفارش و لینک پیگیری و پرداخت. یادآوری پرداخت هم با همین گزینه روشن یا خاموش می‌شود." },
  { name: "smsOnPaid", label: "تأیید پرداخت", hint: "وقتی پرداختی را تأیید می‌کنید یا مشتری آنلاین پرداخت می‌کند." },
  { name: "smsOnShipped", label: "ارسال", hint: "وقتی سفارش را ارسال می‌کنید، همراه با کد رهگیری." },
];

export function SmsSettingsForm({
  action: save,
  initial,
  quotaReached,
}: {
  action: (state: SmsSettingsState, formData: FormData) => Promise<SmsSettingsState>;
  initial: Switches;
  quotaReached: boolean;
}) {
  const [state, action, pending] = useActionState(save, undefined);
  return (
    <form action={action} className="flex max-w-lg flex-col gap-4">
      <p className="text-sm text-muted">
        پیامک‌ها خودکار به موبایل مشتری می‌روند و هر کدام برای هر سفارش حداکثر یک بار فرستاده می‌شود.
      </p>
      {quotaReached && (
        <p role="alert" className="rounded-lg bg-warning-bg p-3 text-sm text-warning">
          سهمیهٔ پیامک پلن شما برای این ماه تمام شده و فعلاً برای مشتری‌ها پیامکی فرستاده نمی‌شود. ثبت سفارش مثل
          قبل ادامه دارد.
        </p>
      )}
      {ROWS.map((row) => (
        <label key={row.name} className="flex items-start gap-2 text-sm">
          <input type="checkbox" name={row.name} defaultChecked={initial[row.name]} className="mt-1" />
          <span>
            <span className="font-medium">{row.label}</span>
            <span className="block text-xs text-muted">{row.hint}</span>
          </span>
        </label>
      ))}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "در حال ذخیره…" : "ذخیرهٔ تنظیمات پیامک"}
        </Button>
        {state?.savedAt && !pending && <span className="text-sm text-success">ذخیره شد.</span>}
      </div>
    </form>
  );
}
