"use client";

import { useActionState, useState } from "react";
import { ArrowUpLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, type LoginState } from "./actions";
import styles from "../marketing.module.css";

const initialState: LoginState = { step: "mobile" };

export function LoginForm() {
  const [formKey, setFormKey] = useState(0);

  return <LoginFormFields key={formKey} onEditNumber={() => setFormKey((key) => key + 1)} />;
}

function LoginFormFields({ onEditNumber }: { onEditNumber: () => void }) {
  const [state, action, pending] = useActionState(loginAction, initialState);
  const isCodeStep = state.step === "code";

  return (
    <form action={action} className={styles.authForm}>
      <input type="hidden" name="step" value={state.step} />

      {isCodeStep ? (
        <>
          <input type="hidden" name="mobile" value={state.mobile} />
          <p className={styles.sentMessage}>کد تأیید به شمارهٔ <span dir="ltr">{state.mobile}</span> پیامک شد.</p>
          <div className={styles.field}>
            <Label htmlFor="code" className={styles.fieldLabel}>کد تأیید</Label>
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              dir="ltr"
              className={styles.authInput}
              aria-describedby={state.error ? "auth-error" : undefined}
              autoFocus
              required
            />
            <p className={styles.fieldHint}>کد شش‌رقمی پیامک را وارد کنید.</p>
          </div>
          <button type="button" onClick={onEditNumber} className={styles.editNumber}>تغییر شماره یا دریافت کد جدید</button>
        </>
      ) : (
        <div className={styles.field}>
          <Label htmlFor="mobile" className={styles.fieldLabel}>شمارهٔ موبایل</Label>
          <Input
            id="mobile"
            name="mobile"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="09123456789"
            defaultValue={state.mobile}
            dir="ltr"
            className={styles.authInput}
            aria-describedby={state.error ? "auth-error" : "mobile-hint"}
            autoFocus
            required
          />
          <p id="mobile-hint" className={styles.fieldHint}>شماره باید با ۰۹ شروع شود.</p>
        </div>
      )}

      {state.error && <p id="auth-error" role="alert" className={styles.formError}>{state.error}</p>}

      <Button type="submit" disabled={pending} className={styles.authSubmit}>
        {pending ? "کمی صبر کنید…" : isCodeStep ? "ورود" : "دریافت کد تأیید"}
        {!pending && <ArrowUpLeft size={19} aria-hidden="true" />}
      </Button>
    </form>
  );
}
