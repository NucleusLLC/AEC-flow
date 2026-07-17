/**
 * Route gating (Next 16 "proxy" convention — formerly middleware).
 *
 * Two responsibilities:
 *
 * 1. BETA PORTAL host routing. The public beta subdomain (beta.aec-flow.com,
 *    also bet.*) serves the marketing/onboarding portal, NOT the app. On that
 *    host the root renders `/beta-portal`, `/signup` + `/login` stay reachable,
 *    and any stray app path funnels back to the portal. `/beta-portal` itself is
 *    public on every host (it's a landing page), regardless of AUTH_ENFORCE.
 *
 * 2. AUTH gating for the main app, behind AUTH_ENFORCE:
 *     - AUTH_ENFORCE unset / != "true"  → pass-through (no gating). DEFAULT.
 *     - AUTH_ENFORCE === "true"         → unauthenticated requests redirect to
 *       /login?callbackUrl=<path>.
 *
 * The matcher already excludes auth endpoints, the login/signup pages, and
 * static assets.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const ENFORCE = process.env.AUTH_ENFORCE === "true";

/** True for the public beta subdomain (beta.* or bet.*). */
function isBetaHost(req: NextRequest): boolean {
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").toLowerCase();
  return host.startsWith("beta.") || host.startsWith("bet.");
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // The beta portal landing is public everywhere.
  if (pathname === "/beta-portal" || pathname.startsWith("/beta-portal/")) {
    return NextResponse.next();
  }

  // Beta subdomain: it's the portal, not the app.
  if (isBetaHost(req)) {
    if (pathname === "/") {
      return NextResponse.rewrite(new URL("/beta-portal", req.url));
    }
    // Onboarding + framework paths stay reachable; everything else on this host
    // returns to the portal (the app lives on the primary domain).
    const publicOnBeta =
      pathname === "/signup" ||
      pathname === "/login" ||
      pathname.startsWith("/api/") ||
      pathname.startsWith("/_next") ||
      pathname.startsWith("/favicon") ||
      /\.[a-z0-9]+$/i.test(pathname);
    if (!publicOnBeta) {
      return NextResponse.redirect(new URL("/beta-portal", req.url));
    }
    return NextResponse.next();
  }

  // Main app auth gate.
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
