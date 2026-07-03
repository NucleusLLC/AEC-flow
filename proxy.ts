/**
 * Route gating (Next 16 "proxy" convention — formerly middleware).
 *
 * Gated behind AUTH_ENFORCE so auth can ship without disrupting other work:
 *  - AUTH_ENFORCE unset / != "true"  → pass-through (no gating). DEFAULT.
 *  - AUTH_ENFORCE === "true"         → unauthenticated requests redirect to
 *    /login?callbackUrl=<path>.
 *
 * Flip it on by setting AUTH_ENFORCE=true in .env and restarting the server.
 * The matcher already excludes auth endpoints, the login page, and static
 * assets, so enabling it gates the whole app and nothing else.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const ENFORCE = process.env.AUTH_ENFORCE === "true";

export async function proxy(req: NextRequest) {
  if (!ENFORCE) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (token) return NextResponse.next();

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!api/auth|login|signup|invite|_next/static|_next/image|favicon.ico).*)"],
};
