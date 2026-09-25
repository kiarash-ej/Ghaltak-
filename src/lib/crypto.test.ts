import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, lastFour } from "./crypto";

const KEY_A = randomBytes(32).toString("base64");
const KEY_B = randomBytes(32).toString("base64");

describe("secret encryption", () => {
  const saved = process.env.SECRETS_KEY;
  beforeEach(() => {
    process.env.SECRETS_KEY = KEY_A;
  });
  afterEach(() => {
    process.env.SECRETS_KEY = saved;
  });

  it("round-trips, including Persian text", () => {
    for (const value of ["6037991234567890", "IR820540102680020817909002", "کلید زرین‌پال", ""]) {
      expect(decryptSecret(encryptSecret(value))).toBe(value);
    }
  });

  it("never stores the plain value and never repeats a ciphertext", () => {
    const a = encryptSecret("6037991234567890");
    const b = encryptSecret("6037991234567890");
    expect(a).not.toContain("6037991234567890");
    expect(a).not.toBe(b); // random IV per value
    expect(a.startsWith("v1.")).toBe(true);
  });

  it("rejects a tampered value", () => {
    const stored = encryptSecret("merchant-123");
    const raw = Buffer.from(stored.slice(3), "base64url");
    raw[raw.length - 1] ^= 0x01; // flip one bit of the ciphertext
    expect(() => decryptSecret(`v1.${raw.toString("base64url")}`)).toThrow();
  });

  it("rejects the wrong key", () => {
    const stored = encryptSecret("merchant-123");
    process.env.SECRETS_KEY = KEY_B;
    expect(() => decryptSecret(stored)).toThrow();
  });

  it("refuses to run without a proper 32-byte key", () => {
    process.env.SECRETS_KEY = "";
    expect(() => encryptSecret("x")).toThrow(/SECRETS_KEY/);
    process.env.SECRETS_KEY = Buffer.from("too short").toString("base64");
    expect(() => encryptSecret("x")).toThrow(/SECRETS_KEY/);
  });

  it("rejects values that aren't ours", () => {
    expect(() => decryptSecret("6037991234567890")).toThrow();
    expect(() => decryptSecret("v2.abc")).toThrow();
    expect(() => decryptSecret("v1.")).toThrow();
  });

  it("shows at most the last four characters", () => {
    expect(lastFour("6037991234567890")).toBe("•••• 7890");
  });
});
