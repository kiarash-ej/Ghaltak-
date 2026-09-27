import { SiteShell } from "@/components/landing/site-shell";

// Public (see PUBLIC_PREFIXES in src/proxy.ts): a seller can read the guide
// before signing up. The shared public header offers login in a popup.

export default function HelpLayout({ children }: LayoutProps<"/help">) {
  return (
    <SiteShell>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 md:py-10">{children}</main>
    </SiteShell>
  );
}
