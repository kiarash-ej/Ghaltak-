import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Owner-only server code (docs/phase2/specs/A10-team.md, section 1): every
// entry point checks requireOwner() itself, so an operator can't reach it by
// calling the action or opening the URL directly. A new requireSeller() or
// requireMember() in these files is almost certainly a hole.
const OWNER_ONLY = [
  "src/server/store/actions.ts",
  "src/server/payments/card-actions.ts",
  "src/server/payments/gateway-actions.ts",
  "src/server/notifications/settings-actions.ts",
  "src/server/billing/actions.ts",
  "src/app/(dashboard)/settings/payments/page.tsx",
  "src/app/(dashboard)/settings/billing/page.tsx",
  "src/app/(dashboard)/settings/team/page.tsx",
];

describe("owner-only entry points", () => {
  it.each(OWNER_ONLY)("%s checks requireOwner() and nothing weaker", (file) => {
    const source = readFileSync(path.resolve(file), "utf8");
    expect(source).toMatch(/await requireOwner\(\)/);
    expect(source).not.toMatch(/requireSeller\(|requireMember\(/);
  });

  it("every exported action in the owner-only action files calls requireOwner()", () => {
    for (const file of OWNER_ONLY.filter((f) => f.startsWith("src/server/"))) {
      const source = readFileSync(path.resolve(file), "utf8");
      const actions = source.split(/export async function /).slice(1);
      for (const body of actions) {
        const name = body.slice(0, body.indexOf("("));
        expect(body.split(/\nexport /)[0], `${file}: ${name}`).toMatch(/await requireOwner\(\)/);
      }
    }
  });

  it("team actions: invite, remove and sign-out-member are owner only", () => {
    const source = readFileSync(path.resolve("src/server/team/actions.ts"), "utf8");
    for (const name of ["inviteMemberAction", "removeMemberAction", "signOutMemberAction"]) {
      const body = source.split(`export async function ${name}`)[1].split(/\nexport /)[0];
      expect(body, name).toMatch(/await requireOwner\(\)/);
    }
  });
});
