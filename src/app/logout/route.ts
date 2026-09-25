import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, decryptSession } from "@/server/session-token";
import { revokeSession } from "@/server/sessions";

// Clears the session cookie and goes to /login. requireMember() redirects here
// when the cookie is validly signed but its session no longer counts (signed
// out elsewhere, member removed, device limit, store deleted). Cookies cannot
// be changed during a page render, and without this the proxy and
// requireMember would redirect back and forth. A session still valid when
// someone opens /logout directly is revoked too.
export async function GET(request: NextRequest) {
  const session = await decryptSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) await revokeSession(session.sid);
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
