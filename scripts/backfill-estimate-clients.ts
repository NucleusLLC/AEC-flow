/**
 * One-shot backfill: link existing estimates to their Client.
 *
 * `cost_estimates.client` has always been a free-text NAME with no foreign key, so no
 * estimate was reachable from the client side (the client page showed nothing). The
 * schema now has `clientId`; this fills it in for rows written before it existed.
 *
 * Resolution order mirrors resolveClientId() in lib/data/estimates.ts:
 *   1. the estimate's project (a Project has a required clientId) — probing both
 *      `projectId` and the estimate's own `id`, since an estimate started from a
 *      project is keyed by that project's id;
 *   2. an exact, case-insensitive match on the typed client name, WITHIN the same
 *      company (two tenants may both have a "Ryan Jones" — never cross that line).
 *
 * Read-only unless it finds a match; rows it can't resolve are reported, not guessed.
 * Uses the raw client (not lib/db) so it runs unscoped across every company.
 *
 * Run:  npx tsx --tsconfig scripts/tsconfig.json scripts/backfill-estimate-clients.ts
 *       add --dry to report without writing.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 needs a driver adapter (same as lib/db.ts). The raw client — NOT lib/db —
// so the tenant extension doesn't scope this to one company: the backfill spans all.
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const DRY = process.argv.includes("--dry");

async function main() {
  const estimates = await prisma.costEstimate.findMany({
    where: { clientId: null },
    select: { id: true, projectId: true, projectName: true, client: true, companyId: true },
  });

  console.log(`${estimates.length} estimate(s) with no client link${DRY ? "  [dry run]" : ""}\n`);

  let viaProject = 0;
  let viaName = 0;
  const unresolved: string[] = [];

  for (const e of estimates) {
    let clientId: string | null = null;
    let how = "";

    for (const pid of [e.projectId, e.id]) {
      if (!pid || clientId) continue;
      const project = await prisma.project.findUnique({ where: { id: pid }, select: { clientId: true } });
      if (project?.clientId) {
        clientId = project.clientId;
        how = "project";
      }
    }

    if (!clientId && e.client?.trim()) {
      const match = await prisma.client.findFirst({
        // companyId scoping matters: an unscoped name match could link an estimate to
        // another tenant's client of the same name.
        where: { name: { equals: e.client.trim(), mode: "insensitive" }, companyId: e.companyId },
        select: { id: true },
      });
      if (match) {
        clientId = match.id;
        how = "name";
      }
    }

    if (!clientId) {
      unresolved.push(`${e.projectName} (client: ${e.client ?? "—"})`);
      continue;
    }

    if (!DRY) await prisma.costEstimate.update({ where: { id: e.id }, data: { clientId } });
    if (how === "project") viaProject++;
    else viaName++;
    console.log(`  ✓ ${e.projectName}  →  client ${clientId}  (via ${how})`);
  }

  console.log(`\nlinked: ${viaProject + viaName}  (${viaProject} via project, ${viaName} via name)`);
  if (unresolved.length) {
    console.log(`unresolved: ${unresolved.length} — no matching project or client record`);
    for (const u of unresolved) console.log(`  · ${u}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
