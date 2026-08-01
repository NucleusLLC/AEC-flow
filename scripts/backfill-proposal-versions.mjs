/**
 * One-off backfill: give every Service Proposal written before the versioning rule
 * a version label, so the version reads as something instead of nothing.
 *
 * Until lib/proposals/versioning.ts landed, versionLabel was only ever set when a
 * proposal was ISSUED, as `${revision}.0`. Every draft therefore holds null, and a
 * null renders as no version at all — which is why the turquoise label was
 * invisible on existing documents.
 *
 * The rule applied here matches the live one exactly:
 *   already issued (has an issuedAt)  ->  `${revision}.0`   a version a client received
 *   never issued                      ->  "0.1"             a fresh draft
 *
 * Idempotent: only rows with a null or blank label are touched, so re-running it
 * cannot move a version that already exists.
 *
 *   node scripts/backfill-proposal-versions.mjs          # report only
 *   node scripts/backfill-proposal-versions.mjs --apply  # write
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const rows = await prisma.serviceProposal.findMany({
  select: { id: true, number: true, status: true, revision: true, issuedAt: true, versionLabel: true },
  orderBy: { number: "asc" },
});

let changed = 0;
for (const p of rows) {
  const has = p.versionLabel && p.versionLabel.trim() !== "";
  const label = p.issuedAt ? `${p.revision}.0` : "0.1";
  if (has) {
    console.log(`skip   ${p.number}  keeps ${p.versionLabel}`);
    continue;
  }
  console.log(`${apply ? "set   " : "would "} ${p.number}  ${p.status}  -> v${label}`);
  if (apply) {
    await prisma.serviceProposal.update({ where: { id: p.id }, data: { versionLabel: label } });
  }
  changed += 1;
}

console.log(`\n${rows.length} proposals, ${changed} ${apply ? "updated" : "to update"}`);
await prisma.$disconnect();
