"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useRef } from "react";
import { LoginForm } from "@/app/login/login-form";
import styles from "@/app/marketing.module.css";

// The public pages (landing, guide, privacy) are open to everyone. Anything
// that needs an account opens this popup with the same form as /login
// (mobile number, then the SMS code); logging in there lands on the dashboard.

const OpenLogin = createContext<{ open: () => void; signedIn: boolean } | null>(null);

/**
 * Owns the one login popup of a public page; LoginButton anywhere inside opens
 * it. `signedIn` (from the session cookie): the buttons lead to the dashboard.
 */
export function LoginDialogProvider({ children, signedIn }: { children: React.ReactNode; signedIn: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const open = useCallback(() => dialog.current?.showModal(), []);
  const close = () => dialog.current?.close();

  return (
    <OpenLogin.Provider value={{ open, signedIn }}>
      {children}
      <dialog
        ref={dialog}
        aria-labelledby="login-dialog-title"
        // A click on the backdrop lands on the dialog itself, not its content.
        onClick={(e) => e.target === e.currentTarget && close()}
        className={styles.dialog}
      >
        <div className={styles.dialogContent}>
          <div className={styles.dialogHeading}>
            <div>
              <h2 id="login-dialog-title" className={styles.dialogTitle}>
                ورود یا ساخت حساب
              </h2>
              <p className={styles.dialogDescription}>
                شمارهٔ موبایل خود را وارد کنید تا کد تأیید برایتان پیامک شود. اگر حساب ندارید، پس از تأیید شماره ساخته می‌شود.
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="بستن"
              className={styles.dialogClose}
            >
              ×
            </button>
          </div>
          <LoginForm />
        </div>
      </dialog>
    </OpenLogin.Provider>
  );
}

/**
 * A link to /login that opens the popup instead. Without JavaScript (or
 * outside a provider) it still works as a plain link to the login page. For a
 * seller who is already signed in it is «ورود به داشبورد».
 */
export function LoginButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const login = useContext(OpenLogin);
  if (login?.signedIn) {
    return (
      <Link href="/" className={className}>
        ورود به داشبورد
      </Link>
    );
  }
  return (
    <a
      href="/login"
      onClick={(e) => {
        if (!login) return;
        e.preventDefault();
        login.open();
      }}
      className={className}
    >
      {children}
    </a>
  );
}
