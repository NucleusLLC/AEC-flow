import { cache } from "react";

/**
 * The current request's companyId, read from the signed-in session and memoised
 * once per request (React cache). Used by the Prisma tenant extension in lib/db
 * to scope every company-owned query.
 *
 * Return meaning:
 *  - string  → scope queries to this company
 *  - null    → a request with no company on the session → scope to nothing (safe/empty)
 *  - undefined → NOT a request context (scripts, seeds, build) → do NOT scope
 *
 * Dynamic imports keep this off the static import graph of lib/db (which would
 * otherwise cycle: db → this → auth → db).
 */
export const currentCompanyId = cache(async (): Promise<string | null | undefined> => {
  try {
    const [{ getServerSession }, { authOptions }] = await Promise.all([
      import("next-auth"),
      import("@/lib/auth"),
    ]);
    const session = await getServerSession(authOptions);
    return session?.user?.companyId ?? null;
  } catch {
    // cookies() unavailable → not inside a request (script/seed/build).
    return undefined;
  }
});
