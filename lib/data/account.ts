/**
 * Account data-access — the signed-in user's own profile.
 *
 * SERVER-ONLY (imports Prisma → pg). Never import from a client component (see
 * [[aec-prisma-client-boundary]]); client code goes through the server actions in
 * `app/(app)/account/actions.ts`. Password changes live in `lib/server/password.ts`.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { withTermsAcceptance } from "@/lib/legal/policy";

export type AccountProfile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  bio: string | null;
  officeLocation: string | null;
  // Read-only (managed by an admin via the Team module):
  role: string;
  department: string | null;
  discipline: string | null;
  hasPassword: boolean;
};

export type ProfileInput = {
  name: string;
  phone?: string | null;
  bio?: string | null;
  officeLocation?: string | null;
};

export async function getAccount(userId: string): Promise<AccountProfile | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, phone: true, bio: true,
      officeLocation: true, role: true, department: true, discipline: true,
      passwordHash: true,
    },
  });
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    bio: u.bio,
    officeLocation: u.officeLocation,
    role: u.role,
    department: u.department,
    discipline: u.discipline,
    hasPassword: !!u.passwordHash,
  };
}

export type BetaMembership = {
  betaTester: boolean;
  betaSignedUpAt: string | null;
  betaAccessUntil: string | null;
};

/**
 * Read the beta-program metadata stored in the user's preferences JSON
 * (set at self-signup). Returns null for non-beta/legacy accounts.
 */
export async function getBetaMembership(userId: string): Promise<BetaMembership | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });
  const prefs = u?.preferences;
  if (!prefs || typeof prefs !== "object") return null;
  const p = prefs as Record<string, unknown>;
  if (p.betaTester !== true) return null;
  return {
    betaTester: true,
    betaSignedUpAt: typeof p.betaSignedUpAt === "string" ? p.betaSignedUpAt : null,
    betaAccessUntil: typeof p.betaAccessUntil === "string" ? p.betaAccessUntil : null,
  };
}

export async function updateProfile(userId: string, input: ProfileInput): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name,
      phone: input.phone ?? null,
      bio: input.bio ?? null,
      officeLocation: input.officeLocation ?? null,
    },
  });
}

/*
 * Password changes used to live here. They now live in `lib/server/password.ts`,
 * which holds BOTH flows (self-change and admin-set) next to each other so the
 * company scoping and the role gate are enforced in one reviewable place. Nothing
 * in this file hashes or compares a password any more.
 */

/**
 * Records that the user accepted the current Terms of Service and Privacy
 * Policy, keeping every other preference. Read-modify-write on the user's own
 * row: the only other writers of `preferences` are this user's own settings
 * screens, which cannot run in the same instant as this click.
 */
export async function acceptCurrentTerms(userId: string, now: Date = new Date()): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
  if (!user) throw new Error("User not found.");
  await prisma.user.update({
    where: { id: userId },
    data: { preferences: withTermsAcceptance(user.preferences, now) as Prisma.InputJsonValue },
  });
}
