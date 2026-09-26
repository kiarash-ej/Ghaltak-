// Small versions of public images (product photos, store logos) for the /buy
// pages, which open on phones over slow mobile data (#47). Photos are stored
// at up to 1600px (shrinkImage) but shown in 56-80px frames, so the page asks
// Next.js's image optimizer (/_next/image) for a copy at the frame's size:
// 1x and 2x, WebP, resized on first request and cached on disk. The stored
// files and their /uploads URLs don't change, and old images get it too.
//
// The URLs are built here, in the format of Next's default image loader,
// instead of with next/image: importing next/image anywhere in a page's server
// code puts its client component in that page's JavaScript (about 5 KiB, #53).
// Every width used here must be in images.imageSizes in next.config.ts, and
// the path in images.localPatterns, or /_next/image answers 400
// (thumbnail.test.ts checks both).

/** Frame sizes in px, as drawn by the components (Tailwind size-20, size-14). */
export const THUMBNAIL_PX = { product: 80, logo: 56 } as const;

/** The only quality allowed by default (images.qualities in Next.js 16). */
const QUALITY = 75;

export type Thumbnail = { src: string; srcSet: string; width: number; height: number };

function optimizedUrl(src: string, width: number): string {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${QUALITY}`;
}

/** A square `size`×`size` px thumbnail of a public image served from /uploads. */
export function thumbnail(url: string, size: number): Thumbnail {
  return {
    src: optimizedUrl(url, size),
    srcSet: `${optimizedUrl(url, size)} 1x, ${optimizedUrl(url, size * 2)} 2x`,
    width: size,
    height: size,
  };
}
