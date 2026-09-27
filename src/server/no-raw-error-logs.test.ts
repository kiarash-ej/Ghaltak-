import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// #50: an error's text can quote a customer's name, mobile and address (Prisma
// puts the call's arguments in its messages), and hosting logs keep it. Server
// code logs errorSummary(err) (src/lib/error-summary.ts) or err.name, never the
// error itself or its message.

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "generated" ? [] : sourceFiles(full);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("error logs carry no error text (#50)", () => {
  it("no console.error or log(...) is given a raw error or its message", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(path.resolve("src"))) {
      const source = readFileSync(file, "utf8");
      source.split("\n").forEach((line, i) => {
        const raw = /(console\.error|\blog)\(.*,\s*err\s*\)/.test(line);
        const message = /message:\s*e\??\.message|\berr(?:or)?\??\.message\b/.test(line) && /console\.error|\blog\(/.test(line);
        if (raw || message) offenders.push(`${path.relative(process.cwd(), file)}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
