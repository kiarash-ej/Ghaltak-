import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/server/session-token";

// Clears the session cookie and goes to /login. requireSeller() redirects here
// when the cookie is validly signed but its seller no longer exists (deleted
// account, restored database). Cookies cannot be changed during a page render,
// and without this the proxy and requireSeller would redirect back and forth.
export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
