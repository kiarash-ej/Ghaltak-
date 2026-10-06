import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hasTestDatabase } from "@/test/setup";
import { verifyOtp } from "./otp";

// A login code allows MAX_ATTEMPTS (5) guesses in total, even when many
// guesses arrive at the same moment: each try is taken in one conditional
// update before the code is compared, so parallel requests can't all see
// "no tries used yet" and each get a guess (brute force against 6 digits).

describe.skipIf(!hasTestDatabase)("login code tries (database)", () => {
  const mobile = `0990${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;

  afterAll(async () => {
    await prisma.otpCode.deleteMany({ where: { mobile } });
  });

  it("twenty wrong guesses at once use up exactly five tries, and every one is refused", async () => {
    // The real code's hash is irrelevant here: no guess below can match it.
    const code = await prisma.otpCode.create({
      data: { mobile, codeHash: "00".repeat(32), expiresAt: new Date(Date.now() + 2 * 60 * 1000) },
    });
    const guesses = Array.from({ length: 20 }, (_, i) => String(100000 + i));
    const results = await Promise.all(guesses.map((g) => verifyOtp(mobile, g)));

    expect(results.every((r) => !r.ok && r.error === "INVALID")).toBe(true);
    const after = await prisma.otpCode.findUniqueOrThrow({ where: { id: code.id }, select: { attempts: true, consumed: true } });
    expect(after).toEqual({ attempts: 5, consumed: false });
  });
});
