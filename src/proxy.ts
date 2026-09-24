import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, decryptSession } from "@/server/session-token";

// Optimistic auth check only (cookie signature). The real authorization
// happens in requireSeller() next to the data access.

const PUBLIC_PREFIXES = ["/login", "/buy"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const session = await decryptSession(
    request.cookies.get(SESSION_COOKIE)?.value,
  );

  if (!isPublic && !session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (pathname === "/login" && session) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Skip Next internals and any path with a file extension (static assets).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
