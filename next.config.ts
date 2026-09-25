import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
