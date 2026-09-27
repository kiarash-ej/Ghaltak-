import Image from "next/image";
import Link from "next/link";
import { GUIDES } from "@/app/help/guides";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { readSession } from "@/server/session";
import { FEATURE_GROUPS } from "./content";
import { LoginButton, LoginDialogProvider } from "./login-dialog";
import { MobileMenu, NavMenu, type NavGroup, type NavLink } from "./nav-menu";

// Header, footer and login popup of the public pages: the landing page (/ for
// visitors), the guide (/help) and the privacy page. All public (PUBLIC_PREFIXES
// in src/proxy.ts). The session is only read from the cookie, to offer
// «ورود به داشبورد» instead of the login buttons; nothing here needs the database.

/** Where the landing page's sections are: "" on the landing page itself. */
function menuGroups(landing: string): NavGroup[] {
  return [
    {
      label: "امکانات",
      links: FEATURE_GROUPS.map((g) => ({ href: `${landing}#${g.id}`, label: g.title, description: g.summary })),
    },
    {
      label: "راهنما",
      links: [
        ...GUIDES.map((g) => ({ href: `/help/${g.slug}`, label: g.title })),
        { href: "/help", label: "همهٔ راهنماها" },
      ],
    },
  ];
}

function extraLinks(landing: string): NavLink[] {
  return [
    { href: `${landing}#sms`, label: "پیامک‌ها" },
    { href: "/privacy", label: "حریم خصوصی" },
  ];
}

export async function SiteShell({
  children,
  onLanding = false,
}: {
  children: React.ReactNode;
  /** True on the landing page: its menu links are anchors on the same page. */
  onLanding?: boolean;
}) {
  const signedIn = Boolean(await readSession());
  const landing = onLanding ? "" : "/welcome";
  const groups = menuGroups(landing);
  const extra = extraLinks(landing);

  return (
    <LoginDialogProvider signedIn={signedIn}>
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 backdrop-blur">
          <div className="relative mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
            <Link href="/" className="flex shrink-0 items-center gap-2">
              <Image src="/brand/logo-symbol.png" alt="" width={32} height={32} />
              <span className="font-bold">غلتک</span>
            </Link>

            <nav aria-label="منوی اصلی" className="ms-4 hidden items-center gap-1 md:flex">
              {groups.map((g) => (
                <NavMenu key={g.label} group={g} />
              ))}
              {extra.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
                >
                  {l.label}
                </Link>
              ))}
            </nav>

            <div className="ms-auto flex items-center gap-2">
              <nav aria-label="منوی اصلی" className="md:hidden">
                <MobileMenu groups={groups} extra={extra} />
              </nav>
              {signedIn ? (
                <Link href="/" className={cn(buttonVariants({ size: "sm" }))}>
                  ورود به داشبورد
                </Link>
              ) : (
                <>
                  <LoginButton className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")}>
                    ورود
                  </LoginButton>
                  <LoginButton className={cn(buttonVariants({ size: "sm" }))}>شروع کنید</LoginButton>
                </>
              )}
            </div>
          </div>
        </header>

        {children}

        <footer className="border-t border-neutral-200 bg-neutral-50">
          <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 text-sm text-neutral-600 md:flex-row md:items-center md:justify-between">
            <p>غلتک: مدیریت فروش آنلاین برای فروشگاه‌های اینستاگرامی و تلگرامی.</p>
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              <li>
                <Link href={`${landing}#features`} className="hover:text-neutral-900">
                  امکانات
                </Link>
              </li>
              <li>
                <Link href="/help" className="hover:text-neutral-900">
                  راهنما
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-neutral-900">
                  حریم خصوصی
                </Link>
              </li>
              <li>
                {signedIn ? (
                  <Link href="/" className="hover:text-neutral-900">
                    داشبورد
                  </Link>
                ) : (
                  <LoginButton className="hover:text-neutral-900">ورود یا ساخت حساب</LoginButton>
                )}
              </li>
            </ul>
          </div>
        </footer>
      </div>
    </LoginDialogProvider>
  );
}
