"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { SmsSettingsState } from "@/server/notifications/settings-actions";

type Switches = { smsOnOrderPlaced: boolean; smsOnPaid: boolean; smsOnShipped: boolean };

const ROWS: { name: keyof Switches; label: string; hint: string }[] = [
  { name: "smsOnOrderPlaced", label: "ثبت سفارش", hint: "کد سفارش و لینک پیگیری و پرداخت؛ یادآوری پرداخت هم با همین روشن است." },
  { name: "smsOnPaid", label: "تأیید پرداخت", hint: "وقتی پرداخت را تأیید می‌کنید یا پرداخت آنلاین انجام می‌شود." },
  { name: "smsOnShipped", label: "ارسال", hint: "با کد رهگیری، وقتی سفارش را ارسال می‌کنید." },
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
      <p className="text-sm text-neutral-600">
        پیامک‌ها خودکار به موبایل مشتری فرستاده می‌شوند، هر رویداد حداکثر یک بار برای هر سفارش.
      </p>
      {quotaReached && (
        <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          سهمیهٔ پیامک پلن شما در این ماه تمام شده است و پیامک‌های مشتری فعلاً ارسال نمی‌شوند. سفارش‌ها مثل قبل ثبت
          می‌شوند.
        </p>
      )}
      {ROWS.map((row) => (
        <label key={row.name} className="flex items-start gap-2 text-sm">
          <input type="checkbox" name={row.name} defaultChecked={initial[row.name]} className="mt-1" />
          <span>
            <span className="font-medium">{row.label}</span>
            <span className="block text-xs text-neutral-500">{row.hint}</span>
          </span>
        </label>
      ))}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "در حال ذخیره…" : "ذخیرهٔ تنظیمات پیامک"}
        </Button>
        {state?.savedAt && !pending && <span className="text-sm text-green-700">ذخیره شد.</span>}
      </div>
    </form>
  );
}
