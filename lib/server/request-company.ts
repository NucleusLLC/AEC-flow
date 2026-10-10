import { AsyncLocalStorage } from "node:async_hooks";
import { cache } from "react";

/**
 * A company named for the duration of one async call — for ROUTE HANDLERS with no
 * session (the Stripe webhook, the public /pay checkout). React `cache` memoises
 * only inside a React render; a route handler is not one, so there
 * `companyOverride()` hands back a fresh object on every call and a value set on
 * it is never seen again. AsyncLocalStorage follows the awaited call instead.
 */
const companyScope = new AsyncLocalStorage<string>();

/**
 * Run `fn` with every tenant-scoped query limited to `companyId`. Use it only
 * after the caller has proved which company the work belongs to (a verified
 * Stripe signature naming the connected account, an unguessable pay token).
 */
export function runAsCompany<T>(companyId: string, fn: () => Promise<T>): Promise<T> {
  if (!companyId) throw new Error("runAsCompany needs a company.");
  return companyScope.run(companyId, fn);
}

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
  // A route handler acting for one practice with no session (runAsCompany above).
  const scoped = companyScope.getStore();
  if (scoped) return scoped;
  // The office TV board opened with its secret key has no session; it names its
  // company for that one request (app/officedash/page.tsx). Nothing else sets it.
  const override = companyOverride().companyId;
  if (override) return override;
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

/**
 * Per-request company for a screen with no session — only the office TV board
 * after its secret key checks out (lib/officedash/access.ts). Set it BEFORE the
 * request's first scoped query: `currentCompanyId` is memoised per request.
 */
export const companyOverride = cache((): { companyId: string | null } => ({ companyId: null }));
