import { THUMBNAIL_PX, thumbnail } from "@/server/storage/thumbnail";
import type { PublicStoreProfile } from "@/server/store/profile";

// The store's name, logo and contact links at the top of its public pages
// (/buy). Shows only what getPublicStoreProfile returns, which is only what
// the seller chose to publish in /settings.

export function StoreHeader({ profile }: { profile: PublicStoreProfile }) {
  const contacts = [
    profile.instagram && {
      label: "اینستاگرام",
      text: `@${profile.instagram}`,
      href: `https://instagram.com/${profile.instagram}`,
    },
    profile.telegram && {
      label: "تلگرام",
      text: `@${profile.telegram}`,
      href: `https://t.me/${profile.telegram}`,
    },
    profile.contactPhone && {
      label: "تماس",
      text: profile.contactPhone,
      href: `tel:${profile.contactPhone}`,
    },
  ].filter((c): c is { label: string; text: string; href: string } => Boolean(c));

  return (
    <header className="flex items-center gap-3 border-b border-neutral-200 pb-4">
      {profile.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          {...thumbnail(profile.logoUrl, THUMBNAIL_PX.logo)}
          alt={`لوگوی ${profile.name}`}
          className="size-14 shrink-0 rounded-xl border border-neutral-200 object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-xl font-bold text-neutral-600"
        >
          {profile.name.trim().charAt(0)}
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-1">
        <p className="truncate text-lg font-bold">{profile.name}</p>
        {contacts.length > 0 && (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-600">
            {contacts.map((c) => (
              <li key={c.label}>
                {c.label}:{" "}
                <a
                  href={c.href}
                  dir="ltr"
                  className="text-neutral-900 underline-offset-2 hover:underline"
                  {...(c.href.startsWith("https:") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  {c.text}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </header>
  );
}
