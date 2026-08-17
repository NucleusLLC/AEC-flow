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
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;

        // DELIBERATELY UNSCOPED, and must stay that way. This runs BEFORE any
        // session exists — it is what establishes which company the caller belongs
        // to. `User` is not in TENANT_MODELS, so the tenant extension does not
        // touch this call; adding a company filter here would break sign-in.
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;
        if (user.status === "INACTIVE") return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          companyId: user.companyId ?? null,
          image: user.avatarUrl ?? undefined,
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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.companyId = user.companyId ?? null;
      } else if (token.id && token.companyId === undefined) {
        // Token issued before multi-tenancy — backfill companyId so existing
        // sessions don't scope to nothing after Phase 2 goes live.
        const u = await prisma.user.findUnique({
          where: { id: token.id },
          select: { companyId: true },
        });
        token.companyId = u?.companyId ?? null;
      }
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
