import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The customer's pages (/buy) open on phones, often on slow mobile data
// (docs/phase2/QUALITY.md, #53). Their client components must not pull zod
// into the browser: validation runs in the Server Action, and importing a
// constant from a zod module (e.g. server/orders/buy-form.ts) ships all of
// zod, about 29 KiB gzipped. This walks every value import from the pages'
// client components and fails if one reaches a heavy package.
const PUBLIC_PAGES = ["src/app/buy/[token]/page.tsx", "src/app/buy/order/[token]/page.tsx"];
const FORBIDDEN = ["zod"];

/** Module specifiers this file loads at runtime (type-only imports are erased). */
function valueImports(source: string): string[] {
  const specs: string[] = [];
  for (const m of source.matchAll(/^import\s+(type\s+)?([\s\S]*?)\s+from\s+"([^"]+)";/gm)) {
    if (!m[1]) specs.push(m[3]);
  }
  for (const m of source.matchAll(/^import\s+"([^"]+)";/gm)) specs.push(m[1]);
  return specs;
}

/** Our own file for a specifier, or null for a package. */
function resolveLocal(spec: string, from: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join("src", spec.slice(2));
  else if (spec.startsWith(".")) base = path.join(path.dirname(from), spec);
  else return null;
  for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    if (existsSync(base + ext)) return base + ext;
  }
  throw new Error(`${from}: can't resolve ${spec}`);
}

function isClientComponent(file: string): boolean {
  return /^["']use client["'];/.test(readFileSync(file, "utf8").trimStart());
}

/** Every package reached from `entry`, with the import chain that reaches it. */
function packagesReachedFrom(entry: string): Map<string, string[]> {
  const found = new Map<string, string[]>();
  const seen = new Set<string>();
  const walk = (file: string, chain: string[]) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const spec of valueImports(readFileSync(file, "utf8"))) {
      const local = resolveLocal(spec, file);
      if (local) walk(local, [...chain, local]);
      else if (!found.has(spec)) found.set(spec, [...chain, spec]);
    }
  };
  walk(entry, [entry]);
  return found;
}

const clientEntries = [
  ...new Set(
    PUBLIC_PAGES.flatMap((page) =>
      valueImports(readFileSync(page, "utf8"))
        .map((spec) => resolveLocal(spec, page))
        .filter((file): file is string => file !== null && isClientComponent(file)),
    ),
  ),
];

describe("client JavaScript of the public /buy pages", () => {
  it("finds the pages' client components", () => {
    expect(clientEntries).toEqual(
      expect.arrayContaining([
        "src/components/orders/buy-form.tsx",
        "src/components/orders/receipt-upload.tsx",
      ]),
    );
  });

  it.each(clientEntries)("%s does not import zod, even indirectly", (entry) => {
    const reached = packagesReachedFrom(entry);
    for (const pkg of FORBIDDEN) {
      expect(reached.get(pkg)?.join(" -> "), pkg).toBeUndefined();
    }
  });

  it("would catch the import this test exists for", () => {
    // The walk is only useful if it follows @/ imports into server modules.
    expect(packagesReachedFrom("src/server/orders/buy-form.ts").has("zod")).toBe(true);
  });
});
