import { expect, test } from "@playwright/test";

// #48: no page can be framed by another site (clickjacking), and the usual
// hardening headers are on every response, public and seller pages alike.
test("security headers on public and seller pages", async ({ request }) => {
  for (const url of ["/login", "/help", "/"]) {
    const res = await request.get(url, { maxRedirects: 0 });
    const h = res.headers();
    expect(h["x-frame-options"], url).toBe("DENY");
    expect(h["content-security-policy"], url).toContain("frame-ancestors 'none'");
    expect(h["x-content-type-options"], url).toBe("nosniff");
    expect(h["referrer-policy"], url).toBe("strict-origin-when-cross-origin");
    expect(h["x-powered-by"], url).toBeUndefined();
  }
});
