import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hasTestDatabase } from "@/test/setup";
import { globalOtpLimit, requestOtp, verifyOtp } from "./otp";

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

  it("requests for one number at the same moment send one code", async () => {
    const other = `0991${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
    try {
      const results = await Promise.all(Array.from({ length: 8 }, () => requestOtp(other, { globalLimit: 1e9 })));
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.filter((r) => !r.ok && r.error === "COOLDOWN")).toHaveLength(7);
      expect(await prisma.otpCode.count({ where: { mobile: other } })).toBe(1);
    } finally {
      await prisma.otpCode.deleteMany({ where: { mobile: other } });
      await prisma.smsMessage.deleteMany({ where: { to: other } });
    }
  });

  it("refuses new codes once the platform's hourly ceiling is reached", async () => {
    const other = `0991${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
    expect(await requestOtp(other, { globalLimit: 0 })).toEqual({ ok: false, error: "BUSY" });
    expect(await prisma.otpCode.count({ where: { mobile: other } })).toBe(0);
  });

  it("reads the ceiling from LOGIN_SMS_PER_HOUR, ignoring nonsense", () => {
    expect(globalOtpLimit({})).toBe(300);
    expect(globalOtpLimit({ LOGIN_SMS_PER_HOUR: "50" })).toBe(50);
    expect(globalOtpLimit({ LOGIN_SMS_PER_HOUR: "0" })).toBe(300);
    expect(globalOtpLimit({ LOGIN_SMS_PER_HOUR: "abc" })).toBe(300);
  });
});
