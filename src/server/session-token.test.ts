import { beforeAll, describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { decryptSession, encryptSession } from "./session-token";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-at-least-16-characters";
});

describe("session token", () => {
  it("round-trips the seller id", async () => {
    const token = await encryptSession({ sellerId: "seller_1" });
    expect(await decryptSession(token)).toEqual({ sellerId: "seller_1" });
  });

  it("rejects missing and garbage tokens", async () => {
    expect(await decryptSession(undefined)).toBeNull();
    expect(await decryptSession("")).toBeNull();
    expect(await decryptSession("not-a-jwt")).toBeNull();
  });

  it("rejects a token whose payload was tampered with", async () => {
    const token = await encryptSession({ sellerId: "seller_1" });
    const [header, , signature] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ sellerId: "seller_2" }),
    ).toString("base64url");
    expect(await decryptSession(`${header}.${forgedPayload}.${signature}`)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const forged = await new SignJWT({ sellerId: "seller_1" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("some-other-secret-value-123456"));
    expect(await decryptSession(forged)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const expired = await new SignJWT({ sellerId: "seller_1" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(process.env.SESSION_SECRET!));
    expect(await decryptSession(expired)).toBeNull();
  });
});
