"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GatewayFormState } from "@/server/payments/gateway-actions";
import type { GatewayForSettings } from "@/server/payments/gateway-store";

type Action = (state: GatewayFormState, formData: FormData) => Promise<GatewayFormState>;

export function GatewaySettingsForm({
  saveAction,
  testAction,
  initial,
  fakeAllowed,
}: {
  saveAction: Action;
  testAction: Action;
  initial: GatewayForSettings | null;
  fakeAllowed: boolean;
}) {
  const [state, save, saving] = useActionState(saveAction, undefined);
  const [testState, test, testing] = useActionState(testAction, undefined);
  const current = state?.saved !== undefined ? state.saved : initial;
  const errors = state?.errors ?? {};

  const [merchantId, setMerchantId] = useState("");
  const [sandbox, setSandbox] = useState(initial?.sandbox ?? false);
  const [isActive, setIsActive] = useState(initial?.isActive ?? false);
  const [fake, setFake] = useState(initial?.fake ?? false);

  // After a save the merchant id leaves the page for good.
  const [seenSavedAt, setSeenSavedAt] = useState(state?.savedAt);
  if (state?.savedAt !== seenSavedAt) {
    setSeenSavedAt(state?.savedAt);
    setMerchantId("");
  }

  return (
    <div className="flex max-w-lg flex-col gap-5">
      <p className="text-sm text-neutral-600">
        با درگاه زرین‌پال خودتان، مشتری می‌تواند روی صفحهٔ سفارشش آنلاین پرداخت کند و پول مستقیم به حساب شما
        می‌رود. سفارش بعد از تأیید درگاه خودکار «پرداخت‌شده» می‌شود. کارت‌به‌کارت همچنان در دسترس می‌ماند.
      </p>

      <form action={save} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="merchantId">مرچنت کد زرین‌پال</Label>
          <Input
            id="merchantId"
            name="merchantId"
            dir="ltr"
            autoComplete="off"
            placeholder={current?.merchantMasked ? `ذخیره‌شده: ${current.merchantMasked}` : "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"}
            value={merchantId}
            onChange={(e) => setMerchantId(e.target.value)}
          />
          {current?.merchantMasked && (
            <p className="text-xs text-neutral-500">
              مرچنت کد ذخیره‌شده: <span dir="ltr">{current.merchantMasked}</span>. برای تغییر، کد جدید را وارد کنید.
            </p>
          )}
          {errors.merchantId && (
            <p role="alert" className="text-sm text-red-600">
              {errors.merchantId[0]}
            </p>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="sandbox" checked={sandbox} onChange={(e) => setSandbox(e.target.checked)} />
          حالت آزمایشی زرین‌پال (sandbox)، بدون پرداخت واقعی
        </label>
        {fakeAllowed && (
          <label className="flex items-center gap-2 text-sm text-amber-800">
            <input type="checkbox" name="fake" checked={fake} onChange={(e) => setFake(e.target.checked)} />
            درگاه آزمایشی داخلی (فقط برای آزمایش خودکار؛ روی پروداکشن وجود ندارد)
          </label>
        )}
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="isActive" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          پرداخت آنلاین برای مشتری‌ها فعال باشد
        </label>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "در حال ذخیره…" : "ذخیرهٔ درگاه"}
          </Button>
          {state?.savedAt && !saving && <span className="text-sm text-green-700">ذخیره شد.</span>}
        </div>
        {state?.message && (
          <p role="alert" className="text-sm text-red-600">
            {state.message}
          </p>
        )}
      </form>

      {current && (
        <form action={test} className="flex flex-wrap items-center gap-3 border-t border-neutral-200 pt-4">
          <Button type="submit" variant="outline" disabled={testing}>
            {testing ? "در حال آزمایش…" : "آزمایش اتصال"}
          </Button>
          {testState?.test && (
            <span role="status" className={testState.test.ok ? "text-sm text-green-700" : "text-sm text-red-600"}>
              {testState.test.text}
            </span>
          )}
        </form>
      )}
    </div>
  );
}
