import "dotenv/config";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// End-to-end tests (e2e/*.spec.ts): a real browser against a real app server
// and a real, SEPARATE Postgres database (E2E_DATABASE_URL). See e2e/README.md.

export const E2E_PORT = 3100;
// Only used by the e2e server; the tests need it to set a known login code.
export const E2E_SESSION_SECRET = "e2e-only-session-secret-never-used-elsewhere";
// Encrypts card details in the e2e database only (32 bytes, base64). Never a real key.
const E2E_SECRETS_KEY = Buffer.from("e2e-only-secrets-key-32-bytes!!!").toString("base64");

const databaseUrl = process.env.E2E_DATABASE_URL ?? "";

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  // One flow that builds on itself; dev-mode pages compile on first visit.
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    locale: "fa-IR",
    timezoneId: "Asia/Tehran",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Optional: an installed browser instead of Playwright's own Chromium,
        // e.g. "chrome". CI uses the runner's Google Chrome, which saves
        // downloading Chromium on every run. Locally, this skips
        // `npx playwright install chromium` if Chrome is installed.
        channel: process.env.E2E_BROWSER_CHANNEL || undefined,
      },
    },
  ],
  webServer: {
    // Dev mode on its own port and build folder: production mode needs real
    // SMS credentials to log in, and Next.js allows one dev server per build
    // folder, so this one uses .next-e2e and runs next to your usual one.
    command: `node node_modules/next/dist/bin/next dev -p ${E2E_PORT}`,
    url: `http://localhost:${E2E_PORT}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: databaseUrl,
      SESSION_SECRET: E2E_SESSION_SECRET,
      SECRETS_KEY: E2E_SECRETS_KEY,
      // The pretend payment gateway (src/server/payments/fake-gateway.ts).
      // Also needs a non-production server, which `next dev` is.
      E2E_FAKE_GATEWAY: "1",
      UPLOAD_DIR: path.resolve(".e2e-uploads"),
      TRUSTED_PROXY_HOPS: "1",
      APP_DIST_DIR: ".next-e2e",
    },
  },
});
