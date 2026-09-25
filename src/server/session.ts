import "server-only";
import { cookies, headers } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  decryptSession,
  encryptSession,
} from "./session-token";
import { revokeSession, startSession, type SignInRefusal } from "./sessions";

/**
 * Signs this browser into a store as `userId`: a Session row (with the device
 * limit applied, ./sessions.ts) and the cookie pointing at it.
 */
export async function createSession(
  userId: string,
  sellerId: string,
): Promise<{ ok: true } | { ok: false; reason: SignInRefusal }> {
  const userAgent = (await headers()).get("user-agent");
  const started = await startSession({ userId, sellerId, userAgent });
  if (!started.ok) return started;

  const token = await encryptSession({ sid: started.sessionId, userId, sellerId });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return { ok: true };
}

/** Signs this device out: the Session row is revoked, then the cookie removed. */
export async function deleteSession() {
  const cookieStore = await cookies();
  const session = await decryptSession(cookieStore.get(SESSION_COOKIE)?.value);
  if (session) await revokeSession(session.sid);
  cookieStore.delete(SESSION_COOKIE);
}

/** The cookie's contents if its signature is valid. NOT proof the session is still valid: see requireMember(). */
export async function readSession() {
  const cookieStore = await cookies();
  return decryptSession(cookieStore.get(SESSION_COOKIE)?.value);
}
