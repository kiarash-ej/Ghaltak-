import { execFileSync } from "node:child_process";
import path from "node:path";

// Checks the e2e database and brings it up to date with the migrations.
// Every run creates its own seller, so nothing needs to be wiped.
export default function globalSetup() {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) {
    throw new Error(
      "E2E_DATABASE_URL is not set. Point it at a separate database whose name ends in _e2e (see e2e/README.md).",
    );
  }
  const dbName = new URL(url).pathname.slice(1);
  if (!dbName.endsWith("_e2e")) {
    // Guard against running the e2e flow on a development or production database.
    throw new Error(`E2E_DATABASE_URL must point at a database named *_e2e, got "${dbName}".`);
  }

  execFileSync(
    process.execPath,
    [path.join("node_modules", "prisma", "build", "index.js"), "migrate", "deploy", "--config", "prisma7.config.ts"],
    { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } },
  );
}
