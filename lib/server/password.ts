/**
 * Password management — the enforcement layer for both flows:
 *   A. a user changing their own password  (`changeOwnPassword`)
 *   B. an administrator setting another user's password (`setMemberPassword`)
 *
 * SERVER-ONLY: imports Prisma (→ pg), bcrypt and the session. Never import from a
 * client component (see [[aec-prisma-client-boundary]]) — client code calls the
 * server actions in `app/(app)/account/actions.ts` and `app/(app)/settings/actions.ts`.
 *
 * ─── THE TENANT RULE ──────────────────────────────────────────────────────────
 * `User` is deliberately NOT in `TENANT_MODELS` (`lib/db.ts`) — login has to look a
 * user up by email *before* there is a session, so the query extension cannot scope
 * it. Nothing filters `prisma.user.*` by company for us. EVERY user query in this
 * file therefore carries `companyId` in its own `where`, resolved from the actor's
 * own database row. Removing one of those is a cross-tenant account takeover, not a
 * cosmetic bug. Same standing note as `lib/data/team.ts` getTeam().
 *
 * Note we resolve the actor's company and role from the DATABASE, not from the JWT.
 * NextAuth sessions here are JWTs that live on after the row changes, so a token
 * still claiming `role: "ADMIN"` after a demotion, or carrying a stale companyId,
 * must not be able to act on it.
 */
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { isFounderEmail } from "@/lib/server/founder";
import { requireActor } from "@/lib/server/actor";
import { canManagePasswords, validateNewPassword } from "@/lib/password-policy";

/**
 * bcrypt cost. 10 is what the rest of the app already uses — `lib/auth.ts` compares
 * against hashes written at cost 10 by `app/signup/actions.ts`,
 * `lib/data/invitations.ts` and `prisma/set-dev-passwords.mjs`. A second cost factor
 * here would be a second convention for no benefit; bcrypt stores the cost in the
 * hash, so raising it is a one-line change made everywhere at once, not here alone.
 */
const BCRYPT_COST = 10;

/** A member who was acted upon. Deliberately carries NO hash. */
export type PasswordTarget = { id: string; name: string; email: string };

// `requireActor` (session → database row, refusing inactive or companyless
// accounts) now lives in `lib/server/actor.ts`: role changes, status changes and
// invitations need exactly the same resolution and the same gate, and a second
// copy of it here would be a second thing to keep right.

/**
 * Flow A — the signed-in user changes their own password.
 *
 * The current password is verified HERE, server-side, with `bcrypt.compare`. The
 * client mirrors nothing about this check and no "already verified" flag from the
 * client is accepted or even accepted as an argument.
 *
 * Returns the actor (id/name only) so the action can write the audit entry.
 */
export async function changeOwnPassword(
  currentPassword: unknown,
  newPassword: unknown,
): Promise<PasswordTarget> {
  const policy = validateNewPassword(newPassword);
  if (!policy.ok) throw new Error(policy.error);

  const actor = await requireActor();

  const row = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { passwordHash: true },
  });

  // An invited user who never had a password set cannot reach this flow anyway
  // (`lib/auth.ts` refuses to sign in an account whose passwordHash is null, so no
  // session can exist). If one somehow does, fail with a usable instruction rather
  // than crashing on `bcrypt.compare(x, null)` — or, worse, letting the
  // current-password check be skipped because there was nothing to compare against.
  if (!row?.passwordHash) {
    throw new Error("Your account has no password set. Ask an administrator to set one for you.");
  }

  if (typeof currentPassword !== "string" || currentPassword === "") {
    throw new Error("Enter your current password.");
  }
  const matches = await bcrypt.compare(currentPassword, row.passwordHash);
  if (!matches) throw new Error("Current password is incorrect.");

  // Cheap hygiene: a "change" that changes nothing is almost always a mistake.
  if (await bcrypt.compare(newPassword as string, row.passwordHash)) {
    throw new Error("The new password must be different from your current one.");
  }

  const passwordHash = await bcrypt.hash(newPassword as string, BCRYPT_COST);
  // companyId in the where is redundant for a self-update (the id is already the
  // actor's own) but costs nothing and keeps every write in this file to one shape.
  await prisma.user.update({
    where: { id: actor.id, companyId: actor.companyId },
    data: { passwordHash },
  });

  return { id: actor.id, name: actor.name, email: actor.email };
}

/**
 * Flow B — an administrator sets a password for another user in THEIR OWN company.
 *
 * The role gate is enforced here, in the server, not by hiding the Settings button.
 * Returns the target (id/name/email only) so the action can write the audit entry.
 */
export async function setMemberPassword(
  targetUserId: string,
  newPassword: unknown,
): Promise<PasswordTarget> {
  const policy = validateNewPassword(newPassword);
  if (!policy.ok) throw new Error(policy.error);

  const actor = await requireActor();

  // THE ROLE GATE. Enforced server-side, on the role read from the database.
  if (!canManagePasswords(actor.role, actor.isFounder)) {
    throw new Error("Only an administrator or director can set another member's password.");
  }

  // THE COMPANY SCOPE. `User` is not tenant-scoped by the Prisma extension, so this
  // is a `findFirst` with an explicit companyId rather than a `findUnique` by id:
  // the company must be part of the WHERE, not a check applied after the row is
  // already in hand. An id belonging to another firm simply does not match.
  const target = await prisma.user.findFirst({
    where: { id: targetUserId, companyId: actor.companyId },
    select: { id: true, name: true, email: true },
  });
  if (!target) throw new Error("That member is not in your company.");

  // No privilege escalation: nobody resets the founder's password but the founder.
  // The founder account is the platform super-admin (it can edit app-level settings
  // every other account sees locked), so an ADMIN who could reset it would be able
  // to promote themselves past every remaining check in the app.
  if (isFounderEmail(target.email) && !actor.isFounder) {
    throw new Error("The founder's password can only be changed by the founder.");
  }

  const passwordHash = await bcrypt.hash(newPassword as string, BCRYPT_COST);
  await prisma.user.update({
    where: { id: target.id, companyId: actor.companyId },
    data: { passwordHash },
  });

  return target;
}
