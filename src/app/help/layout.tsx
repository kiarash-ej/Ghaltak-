import Image from "next/image";
import Link from "next/link";

// Public (see PUBLIC_PREFIXES in src/proxy.ts): a seller can read the guide
// before signing up, so nothing here reads the session.

export default function HelpLayout({ children }: LayoutProps<"/help">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/help" className="flex items-center gap-2">
            <Image src="/brand/logo-symbol.png" alt="" width={32} height={32} />
            <span className="font-bold">راهنمای غلتک</span>
          </Link>
          <Link href="/" className="text-sm font-medium text-neutral-700 hover:text-neutral-900">
            ورود به غلتک
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 md:py-10">{children}</main>
    </div>
  );
}
