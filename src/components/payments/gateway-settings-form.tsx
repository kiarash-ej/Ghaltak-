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
      <p className="text-sm text-muted">
        اگر درگاه زرین‌پال خودتان را اینجا وصل کنید، مشتری می‌تواند از صفحهٔ سفارشش آنلاین پرداخت کند و پول
        مستقیم به حساب شما می‌رود. وقتی درگاه پرداخت را تأیید کند، سفارش خودکار «پرداخت‌شده» می‌شود.
        کارت‌به‌کارت هم مثل قبل فعال می‌ماند.
      </p>

      <form action={save} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="merchantId">مرچنت‌کد زرین‌پال</Label>
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
            <p className="text-xs text-muted">
              مرچنت‌کد ذخیره‌شده: <span dir="ltr">{current.merchantMasked}</span>. برای تغییر، کد جدید را وارد کنید.
            </p>
          )}
          {errors.merchantId && (
            <p role="alert" className="text-sm text-danger">
              {errors.merchantId[0]}
            </p>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="sandbox" checked={sandbox} onChange={(e) => setSandbox(e.target.checked)} />
          حالت آزمایشی زرین‌پال (sandbox)؛ پرداخت واقعی انجام نمی‌شود
        </label>
        {fakeAllowed && (
          <label className="flex items-center gap-2 text-sm text-warning">
            <input type="checkbox" name="fake" checked={fake} onChange={(e) => setFake(e.target.checked)} />
            درگاه آزمایشی داخلی (فقط برای تست خودکار؛ در نسخهٔ اصلی سایت نیست)
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
          {state?.savedAt && !saving && <span className="text-sm text-success">ذخیره شد.</span>}
        </div>
        {state?.message && (
          <p role="alert" className="text-sm text-danger">
            {state.message}
          </p>
        )}
      </form>

      {current && (
        <form action={test} className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <Button type="submit" variant="outline" disabled={testing}>
            {testing ? "در حال آزمایش…" : "آزمایش اتصال"}
          </Button>
          {testState?.test && (
            <span role="status" className={testState.test.ok ? "text-sm text-success" : "text-sm text-danger"}>
              {testState.test.text}
            </span>
          )}
        </form>
      )}
    </div>
  );
}
