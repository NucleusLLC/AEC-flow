/**
 * A Prisma client WITHOUT the tenant extension, for the sample-set installer only.
 *
 * Why it has to exist. `lib/db.ts` scopes every company-owned query to the
 * company on the session. The sample set is written in two places where that
 * scope is the wrong one:
 *   - at signup there is a request but no session yet, so the scope is
 *     `companyId: null` and every read, update and delete matches nothing;
 *   - on the founder's /admin push the session belongs to the FOUNDER's company,
 *     so a read or a delete aimed at a tester's company would silently hit the
 *     founder's rows instead (or none).
 * Neither can be fixed with the per-request override in request-company.ts: that
 * is memoised once per request and the founder push walks many companies.
 *
 * THE RULE THAT REPLACES THE EXTENSION: every query made through this client
 * names its company explicitly: `companyId` in the data of every create and in
 * the where of every read, update and delete on a company-owned model. Rows of
 * child models that carry no companyId are only ever addressed by ids this
 * module created itself or through a parent that was matched with its companyId.
 *
 * Nothing outside lib/samples may import this file; lib/samples/boundary.test.ts
 * fails the build if anything does.
 *
 * SERVER-ONLY.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForSamples = globalThis as unknown as { sampleSetPrisma?: PrismaClient };

/** Created on first use, so a deployment that never installs a sample set never opens the pool. */
export function unscopedPrisma(): PrismaClient {
  if (!globalForSamples.sampleSetPrisma) {
    globalForSamples.sampleSetPrisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
      log: ["error"],
    });
  }
  return globalForSamples.sampleSetPrisma;
}
