import { SignJWT, jwtVerify } from "jose";

// Shared by proxy.ts and the server-only session helpers. No Node-only imports
// here so it stays usable from the proxy runtime.

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

/**
 * `sid` is the Session row (A10); the proxy only checks the signature, and
 * requireSeller() checks the row. A cookie from before A10 has only sellerId
 * and reads as no session, so that person simply signs in again.
 */
export type SessionPayload = { sid: string; userId: string; sellerId: string };

function getKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET is missing or too short (see .env.example)");
  }
  return new TextEncoder().encode(secret);
}

export async function encryptSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getKey());
}

export async function decryptSession(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getKey(), {
      algorithms: ["HS256"],
    });
    const { sid, userId, sellerId } = payload;
    return typeof sid === "string" && typeof userId === "string" && typeof sellerId === "string"
      ? { sid, userId, sellerId }
      : null;
  } catch {
    return null;
  }
}
