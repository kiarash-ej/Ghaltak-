import Image from "next/image";
import Link from "next/link";
import styles from "@/app/marketing.module.css";
import { GUIDES } from "@/app/help/guides";
import { readSession } from "@/server/session";
import { FEATURE_GROUPS } from "./content";
import { LoginButton, LoginDialogProvider } from "./login-dialog";
import { MobileMenu, NavMenu, type NavGroup, type NavLink } from "./nav-menu";
import { ThemeToggle } from "./theme-toggle";

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

function extraLinks(): NavLink[] {
  return [
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
  const extra = extraLinks();

  return (
    <LoginDialogProvider signedIn={signedIn}>
      <div className={`${styles.publicShell} public-surface flex flex-1 flex-col`}>
        <header className={styles.publicHeader}>
          <div className={styles.publicHeaderInner}>
            <Link href="/" className={styles.brand}>
              <Image src="/brand/logo-symbol.png" alt="" width={42} height={42} />
              <span>غلتک</span>
            </Link>

            <nav aria-label="منوی اصلی" className={styles.publicNav}>
              {groups.map((g) => (
                <NavMenu key={g.label} group={g} />
              ))}
              {extra.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={styles.publicNavLink}
                >
                  {l.label}
                </Link>
              ))}
            </nav>

            <div className={styles.publicActions}>
              <ThemeToggle />
              <nav aria-label="منوی اصلی" className="lg:hidden">
                <MobileMenu groups={groups} extra={extra} />
              </nav>
              {signedIn ? (
                <Link href="/" className={styles.headerCta}>
                  ورود به داشبورد
                </Link>
              ) : (
                <>
                  <LoginButton className={styles.headerLogin}>
                    ورود
                  </LoginButton>
                  <LoginButton className={styles.headerCta}>ساخت حساب</LoginButton>
                </>
              )}
            </div>
          </div>
        </header>

        {children}

        <footer className={styles.publicFooter}>
          <div className={styles.publicFooterInner}>
            <p>غلتک؛ مدیریت سفارش، موجودی و فروش برای فروشگاه‌های آنلاین.</p>
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
