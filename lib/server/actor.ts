/**
 * Who is acting, and are they allowed to administer this company's people.
 *
 * SERVER-ONLY: imports Prisma and the session.
 *
 * ─── WHY THIS IS ITS OWN MODULE ───────────────────────────────────────────────
 * Administering members is one privilege with several doors: setting someone's
 * role, deactivating them, inviting a new person, and setting a password. Those
 * doors were guarded inconsistently — password management enforced a role, while
 * role and status changes only checked that *somebody* was signed in, which meant
 * any signed-in user could promote themselves to ADMIN and then walk through the
 * password door legitimately. A gate is only as strong as the field it reads, so
 * the resolution and the check live here, once, and every door calls them.
 *
 * ─── THE TENANT RULE ──────────────────────────────────────────────────────────
 * `User` is deliberately NOT in `TENANT_MODELS` (`lib/db.ts`) — login must find a
 * user by email before a session exists, so the query extension cannot scope it.
 * Nothing filters `prisma.user.*` by company for us. Every caller must carry the
 * `companyId` this module returns into its own `where`. Dropping it is a
 * cross-tenant account takeover, not a cosmetic bug.
 *
 * Role and company come from the DATABASE, never the JWT: NextAuth sessions here
 * are JWTs that outlive the row, so a token still claiming `role: "ADMIN"` after a
 * demotion must not be able to act on it.
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isFounderEmail } from "@/lib/server/founder";
import { canManagePasswords } from "@/lib/password-policy";

export type Actor = {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId: string;
  isFounder: boolean;
};

/**
 * Resolve the signed-in actor from their own database row.
 *
 * `findUnique` by the session's own user id needs no company filter — the id IS
 * the identity being resolved, and the row it returns is what defines which
 * company the caller belongs to.
 *
 * Throws rather than returning a partial actor, so a caller cannot forget to check.
 */
export async function requireActor(): Promise<Actor> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) throw new Error("You must be signed in.");

  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, status: true, companyId: true },
  });
  if (!row) throw new Error("Your account could not be found.");
  // A deactivated account may still be holding a valid JWT — it must not act.
  if (row.status === "INACTIVE") throw new Error("Your account is not active.");
  // No company means no tenant to scope to. We must NOT fall back to
  // `getCurrentCompanyId()` here: that helper resolves an absent companyId to the
  // *founder* company, which would hand a companyless account authority over the
  // founder's own people. Refuse instead.
  if (!row.companyId) throw new Error("Your account is not linked to a company.");

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    companyId: row.companyId,
    isFounder: isFounderEmail(row.email),
  };
}

/**
 * Assert the caller may administer members: change roles, change status, invite,
 * or set a password. ADMIN, DIRECTOR, or the founder — `canManagePasswords` in
 * `lib/password-policy.ts` is the single definition of that set, deliberately
 * shared so the four doors can never drift apart. (The practice owner's own
 * account is a DIRECTOR, so a gate on ADMIN alone would lock him out.)
 *
 * Returns the actor, because every caller needs its `companyId` next.
 */
export async function requireMemberAdmin(): Promise<Actor> {
  const actor = await requireActor();
  if (!canManagePasswords(actor.role, actor.isFounder)) {
    throw new Error("Only an administrator or director can manage members.");
  }
  return actor;
}
