/**
 * Account data-access — the signed-in user's own profile + password.
 *
 * SERVER-ONLY (imports Prisma → pg + bcrypt). Never import from a client
 * component (see [[aec-prisma-client-boundary]]); client code goes through the
 * server actions in `app/(app)/account/actions.ts`.
 */
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

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

/**
 * Change the user's password. Verifies the current password with bcrypt; if the
 * account has no password yet (seeded/invited), the current-password check is
 * skipped so they can set one. Throws a user-facing Error on failure.
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  if (newPassword.length < 8) throw new Error("New password must be at least 8 characters.");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user) throw new Error("Account not found.");

  if (user.passwordHash) {
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new Error("Current password is incorrect.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}
