import { hasLocalMatch } from "next/dist/shared/lib/match-local-pattern";
import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";
import { THUMBNAIL_PX, thumbnail } from "./thumbnail";

// thumbnail() builds /_next/image URLs by hand, so nothing but this test ties
// them to next.config.ts. A width missing from images.imageSizes, or a path
// outside images.localPatterns, makes /_next/image answer 400: a broken
// image on every purchase page.

const PRODUCT = "/uploads/products/0b6c0f9e-8a1d-4c63-9a53-2f1a4d8b7e10.webp";
const LOGO = "/uploads/logos/5f0e4c2a-1b3d-4e5f-8a9b-0c1d2e3f4a5b.png";

/** [original src, width] of every URL in a thumbnail's src and srcset. */
function requests(t: ReturnType<typeof thumbnail>) {
  return [t.src, ...t.srcSet.split(", ").map((c) => c.split(" ")[0])].map((u) => {
    const url = new URL(u, "http://localhost");
    expect(url.pathname).toBe("/_next/image");
    return [url.searchParams.get("url")!, Number(url.searchParams.get("w"))] as const;
  });
}

describe("thumbnail", () => {
  it("asks for 1x and 2x of the frame, at the allowed quality", () => {
    const t = thumbnail(PRODUCT, 80);
    expect(t).toMatchObject({ width: 80, height: 80 });
    expect(t.src).toBe(`/_next/image?url=${encodeURIComponent(PRODUCT)}&w=80&q=75`);
    expect(t.srcSet).toBe(
      `/_next/image?url=${encodeURIComponent(PRODUCT)}&w=80&q=75 1x, ` +
        `/_next/image?url=${encodeURIComponent(PRODUCT)}&w=160&q=75 2x`,
    );
  });

  it.each(Object.entries(THUMBNAIL_PX))("every width for the %s frame is in images.imageSizes", (_, px) => {
    for (const [, w] of requests(thumbnail(PRODUCT, px))) {
      expect(nextConfig.images?.imageSizes).toContain(w);
    }
  });

  it("product photos, logos and the app's own images may be resized; receipts and query strings may not", () => {
    const patterns = nextConfig.images?.localPatterns;
    for (const src of [PRODUCT, LOGO]) {
      for (const [original] of requests(thumbnail(src, THUMBNAIL_PX.product))) {
        expect(hasLocalMatch(patterns, original), original).toBe(true);
      }
    }
    // The app's own next/image sources stay allowed (login, dashboard, help).
    for (const own of ["/brand/logo-with-name.png", "/help/products-form.jpg"]) {
      expect(hasLocalMatch(patterns, own), own).toBe(true);
    }
    expect(hasLocalMatch(patterns, "/uploads/receipts/0b6c0f9e-8a1d-4c63-9a53-2f1a4d8b7e10.webp")).toBe(false);
    expect(hasLocalMatch(patterns, "/orders/abc/receipt")).toBe(false);
    expect(hasLocalMatch(patterns, `${PRODUCT}?v=2`)).toBe(false);
  });
});
