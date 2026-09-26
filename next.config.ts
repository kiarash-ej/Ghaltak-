import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The end-to-end test server builds into its own folder (APP_DIST_DIR, set
  // in playwright.config.ts) so it can run next to the usual dev server:
  // Next.js allows only one dev server per build folder.
  distDir: process.env.APP_DIST_DIR || ".next",
  images: {
    // What /_next/image may resize: our own images in public/ (brand, help
    // screenshots) and uploaded product photos and store logos
    // (src/server/storage/thumbnail.ts). Never receipts, and no query string.
    localPatterns: [
      { pathname: "/brand/**", search: "" },
      { pathname: "/help/**", search: "" },
      { pathname: "/uploads/products/**", search: "" },
      { pathname: "/uploads/logos/**", search: "" },
    ],
    // Next's defaults plus the widths thumbnail() asks for: 56/112 (store
    // logo, 1x/2x) and 80/160 (product photo on /buy).
    imageSizes: [32, 48, 56, 64, 80, 96, 112, 128, 160, 256, 384],
  },
  experimental: {
    serverActions: {
      // Default is 1MB. Product photos (max 2MB, see image-storage.ts) are sent
      // through a Server Action together with the form fields.
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
