"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = { step: "mobile" };

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);
  const isCodeStep = state.step === "code";

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="step" value={state.step} />

      {isCodeStep ? (
        <>
          <input type="hidden" name="mobile" value={state.mobile} />
          <p className="text-sm text-neutral-600">
            کد تأیید به شمارهٔ <span dir="ltr">{state.mobile}</span> پیامک شد.
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="code">کد تأیید</Label>
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              dir="ltr"
              className="text-center tracking-widest"
              autoFocus
              required
            />
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="mobile">شمارهٔ موبایل</Label>
          <Input
            id="mobile"
            name="mobile"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="09123456789"
            defaultValue={state.mobile}
            dir="ltr"
            autoFocus
            required
          />
        </div>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "لطفاً صبر کنید…" : isCodeStep ? "ورود" : "دریافت کد تأیید"}
      </Button>
    </form>
  );
}
