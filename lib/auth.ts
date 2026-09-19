/**
 * NextAuth (v4) configuration — credentials auth against the User table.
 *
 * SERVER-ONLY: this imports `@/lib/db` (Prisma → pg), so it must never be
 * imported by a client component (see [[aec-prisma-client-boundary]]). Client
 * code uses `signIn`/`signOut`/`useSession` from `next-auth/react` instead.
 *
 * Credentials provider requires the JWT session strategy (NextAuth v4 does not
 * support database sessions with Credentials). The user's id + role are carried
 * on the token so server components / middleware can authorize without a DB hit.
 */
import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { clearRateLimit, hitRateLimit } from "@/lib/server/rate-limit";
import { RATE_LIMITS, clientIpFrom, tooManyAttemptsMessage } from "@/lib/account-security/rate-limit-policy";
import { SESSION_RECHECK_SECONDS, tokenStillValid } from "@/lib/account-security/session-version";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;

        // Throttle BEFORE the lookup and the bcrypt compare, per address and per
        // IP (see lib/account-security/rate-limit-policy.ts). A thrown error is how
        // NextAuth hands a message back to `signIn(..., { redirect: false })`; the
        // login form shows it in place of "Incorrect email or password".
        const reqHeaders = (req?.headers ?? {}) as Record<string, string | string[] | undefined>;
        const ip = clientIpFrom((name) => {
          const v = reqHeaders[name];
          return Array.isArray(v) ? v[0] : v;
        });
        for (const [rule, subject] of [
          [RATE_LIMITS.loginIp, ip],
          [RATE_LIMITS.loginEmail, email],
        ] as const) {
          const verdict = await hitRateLimit(rule, subject);
          if (!verdict.allowed) {
            throw new Error(tooManyAttemptsMessage("sign-in attempts", verdict.retryAfterSeconds));
          }
        }

        // DELIBERATELY UNSCOPED, and must stay that way. This runs BEFORE any
        // session exists — it is what establishes which company the caller belongs
        // to. `User` is not in TENANT_MODELS, so the tenant extension does not
        // touch this call; adding a company filter here would break sign-in.
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;
        if (user.status === "INACTIVE") return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        // A person who gets their password right should not stay one typo away
        // from a lockout. The per-IP counter is left alone: it guards spraying.
        await clearRateLimit(RATE_LIMITS.loginEmail, email);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          companyId: user.companyId ?? null,
          image: user.avatarUrl ?? undefined,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
  events: {
    // Beta activity signal. Without this a tester who signed up and never came back looks
    // identical to a daily user — AEC-Flow has no other last-seen field. Best-effort: a failed
    // write must never block a legitimate sign-in.
    async signIn({ user }) {
      if (!user?.id) return;
      try {
        const u = await prisma.user.findUnique({
          where: { id: user.id },
          select: { preferences: true },
        });
        const prefs = (u?.preferences ?? {}) as Record<string, unknown>;
        if (!prefs.betaTester) return;
        await prisma.user.update({
          where: { id: user.id },
          data: {
            preferences: {
              ...prefs,
              lastSeenAt: new Date().toISOString(),
              loginCount: Number(prefs.loginCount ?? 0) + 1,
            },
          },
        });
      } catch (e) {
        console.error("beta last-seen update failed", e);
      }
    },
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.companyId = user.companyId ?? null;
        token.sv = user.sessionVersion ?? 0;
        token.svCheckedAt = Math.floor(Date.now() / 1000);
        return token;
      }
      if (!token.id) return token;

      // SESSION REVOCATION. A JWT cannot be deleted, so a password change or
      // reset bumps User.sessionVersion and every token still carrying the old
      // value is refused here. Checked at most once a minute per token (one
      // indexed read), so revocation lands within SESSION_RECHECK_SECONDS.
      // `trigger === "update"` forces a check and ADOPTS the current version:
      // that is how the browser that just changed its own password stays signed
      // in (account-form calls `update()`), while every other session drops.
      const now = Math.floor(Date.now() / 1000);
      const due = trigger === "update" || token.companyId === undefined ||
        !token.svCheckedAt || now - token.svCheckedAt >= SESSION_RECHECK_SECONDS;
      if (!due) return token;

      const u = await prisma.user.findUnique({
        where: { id: token.id },
        select: { companyId: true, status: true, sessionVersion: true },
      });
      if (trigger === "update" && u && u.status !== "INACTIVE") token.sv = u.sessionVersion;
      if (!tokenStillValid(token.sv, u)) {
        // An empty token has no id: proxy.ts sends it to /login and every
        // server-side session lookup sees no user.
        return {} as typeof token;
      }
      // Token issued before multi-tenancy — backfill companyId so existing
      // sessions don't scope to nothing after Phase 2 goes live.
      token.companyId = u!.companyId ?? null;
      token.svCheckedAt = now;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.companyId = token.companyId ?? null;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
