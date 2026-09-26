import type { NextConfig } from "next";

/**
 * On every response (#48). No page of ours is ever meant to be framed (the
 * payment gateways redirect, they don't embed us), so framing is refused
 * outright: another site can't put the seller's dashboard in an invisible
 * iframe and trick them into clicking «تأیید پرداخت». HSTS is the host
 * proxy's job (DEPLOY.md).
 */
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // The end-to-end test server builds into its own folder (APP_DIST_DIR, set
  // in playwright.config.ts) so it can run next to the usual dev server:
  // Next.js allows only one dev server per build folder.
  distDir: process.env.APP_DIST_DIR || ".next",
  experimental: {
    serverActions: {
      // Default is 1MB. Product photos (max 2MB, see image-storage.ts) are sent
      // through a Server Action together with the form fields.
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
