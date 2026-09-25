import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Data export is for the store's owner only (TRACK-C.md, C6; A10's roles).
// Both entry points check requireOwner() themselves, so an operator gets a
// 404 even when opening the download URL directly (e2e/data-export.spec.ts
// checks that in a browser). Same rule as src/server/owner-only.test.ts.
const ENTRY_POINTS = [
  "src/app/(dashboard)/settings/data/page.tsx",
  "src/app/(dashboard)/settings/data/export/[kind]/route.ts",
];

describe("data export is owner only", () => {
  it.each(ENTRY_POINTS)("%s checks requireOwner() and nothing weaker", (file) => {
    const source = readFileSync(path.resolve(file), "utf8");
    expect(source).toMatch(/await requireOwner\(\)/);
    expect(source).not.toMatch(/requireSeller\(|requireMember\(/);
  });
});
