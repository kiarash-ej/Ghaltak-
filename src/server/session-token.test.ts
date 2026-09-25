import { beforeAll, describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { decryptSession, encryptSession } from "./session-token";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-at-least-16-characters";
});

describe("session token", () => {
  const payload = { sid: "sess_1", userId: "user_1", sellerId: "seller_1" };

  it("round-trips the session, user and seller ids", async () => {
    const token = await encryptSession(payload);
    expect(await decryptSession(token)).toEqual(payload);
  });

  it("reads a cookie from before A10 (seller id only) as no session", async () => {
    const old = await new SignJWT({ sellerId: "seller_1" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(process.env.SESSION_SECRET!));
    expect(await decryptSession(old)).toBeNull();
  });

  it("rejects missing and garbage tokens", async () => {
    expect(await decryptSession(undefined)).toBeNull();
    expect(await decryptSession("")).toBeNull();
    expect(await decryptSession("not-a-jwt")).toBeNull();
  });

  it("rejects a token whose payload was tampered with", async () => {
    const token = await encryptSession(payload);
    const [header, , signature] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ ...payload, sellerId: "seller_2" }),
    ).toString("base64url");
    expect(await decryptSession(`${header}.${forgedPayload}.${signature}`)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const forged = await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("some-other-secret-value-123456"));
    expect(await decryptSession(forged)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const expired = await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(process.env.SESSION_SECRET!));
    expect(await decryptSession(expired)).toBeNull();
  });
});
