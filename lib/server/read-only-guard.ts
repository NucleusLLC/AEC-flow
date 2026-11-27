/**
 * The database backstop for "VIEWER is read-only everywhere" (security audit
 * D-6, owner's ruling 27 Nov 2026).
 *
 * The explicit gates live in front of each dangerous action
 * (lib/permissions/role-gates.ts). This is the net under them: the Prisma tenant
 * extension (lib/db.ts) calls `assertTenantWriteAllowed` before every write to a
 * company-owned model, so a server action nobody remembered to gate still cannot
 * let a VIEWER change the practice's data.
 *
 * SERVER-ONLY. No static import of Prisma or the session — lib/db.ts imports this
 * module, so both are loaded lazily, exactly as lib/server/request-company.ts does.
 * The role is read from the user's DATABASE row, never the JWT: a token issued
 * before a demotion to VIEWER must not keep write access.
 */
import { cache } from "react";
import { explicitCompanyId } from "@/lib/server/request-company";
import { readOnlyWriteRefusal } from "@/lib/permissions/role-gates";

/** Models whose writes are not the practice's data: the activity log records what others did. */
const EXEMPT_MODELS = new Set<string>(["ActivityLog"]);

/** Is this request a server action? Null outside a request (script, seed, build). */
async function inServerAction(): Promise<boolean | null> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    return Boolean(h.get("next-action"));
  } catch {
    return null;
  }
}

/** The signed-in user's role and founder flag, from their row. Memoised per request. */
const sessionRole = cache(async (): Promise<{ role: string; isFounder: boolean } | null> => {
  try {
    const [{ getServerSession }, { authOptions }, { prisma }, { isFounderEmail }] = await Promise.all([
      import("next-auth"),
      import("@/lib/auth"),
      import("@/lib/db"),
      import("@/lib/server/founder"),
    ]);
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) return null;
    const row = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, email: true } });
    if (!row) return null;
    return { role: row.role, isFounder: isFounderEmail(row.email) };
  } catch {
    return null;
  }
});

/** Throws the read-only refusal when a VIEWER writes a company-owned model from a server action. */
export async function assertTenantWriteAllowed(model: string): Promise<void> {
  if (EXEMPT_MODELS.has(model)) return;
  const action = await inServerAction();
  if (!action) return;
  const explicitCompany = Boolean(explicitCompanyId());
  if (explicitCompany) return;
  const who = await sessionRole();
  const refusal = readOnlyWriteRefusal({
    role: who?.role ?? null,
    isFounder: who?.isFounder ?? false,
    inServerAction: action,
    explicitCompany,
  });
  if (refusal) throw new Error(refusal);
}
