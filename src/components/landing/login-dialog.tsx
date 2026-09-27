"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useRef } from "react";
import { LoginForm } from "@/app/login/login-form";

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
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-neutral-200 bg-white p-0 text-neutral-900 shadow-xl backdrop:bg-neutral-900/40"
      >
        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 id="login-dialog-title" className="text-lg font-bold">
                ورود یا ساخت حساب
              </h2>
              <p className="text-sm text-neutral-600">
                شمارهٔ موبایلتان را وارد کنید. اگر حساب ندارید، با همین کد ساخته می‌شود.
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="بستن"
              className="-m-1 rounded-lg p-1 text-2xl leading-none text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
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
