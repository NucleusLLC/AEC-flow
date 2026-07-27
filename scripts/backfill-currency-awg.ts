/**
 * One-shot backfill: retire the legacy "AED" currency code from stored records.
 *
 * Background — the org-wide System Currency is AWG (Aruban florin), but "AED" was
 * hardcoded in a lot of places (see commit 53a180a). The application code is fixed
 * and `Proposal.currency` / `Order.currency` / `Project.currency` now default to
 * 'AWG' at the database level (prisma/sql/0006_currency_defaults_awg.sql) — but a
 * DEFAULT only affects NEW rows. Rows written before the fix still store the literal
 * string "AED" and will keep rendering "AED 1,234" no matter what the config says,
 * because a per-record currency deliberately overrides the system currency.
 *
 * This script rewrites ONLY those stale rows.
 *
 * Safety properties (read this before running):
 *   · DRY RUN BY DEFAULT — it reports counts and writes nothing unless you pass --apply.
 *   · Only rows whose currency is EXACTLY 'AED' are touched. Anything already AWG, or
 *     deliberately set to USD/EUR/…, is left alone.
 *   · Idempotent — after a successful --apply there are no 'AED' rows left, so a second
 *     run is a no-op (it will report 0 candidates).
 *   · It does NOT touch price_items. That table holds real UAE supplier quotes that are
 *     genuinely denominated in AED (lib/data/price-lists.types.ts REGION_CURRENCY);
 *     converting them would corrupt the data. See docs/CURRENCY.md.
 *   · Every other currency-bearing table is SURVEYED (counted) but never written, so a
 *     dry run tells you whether anything unexpected is still carrying AED.
 *
 * Uses the raw PrismaClient — NOT lib/db — so the tenant extension doesn't scope this
 * to one company: the backfill spans every tenant, which is what a data cleanup wants.
 *
 * Run (dry run — safe, read-only):
 *   npx ts-node --project scripts/tsconfig.json -r tsconfig-paths/register scripts/backfill-currency-awg.ts
 *
 * Run (actually write):
 *   npx ts-node --project scripts/tsconfig.json -r tsconfig-paths/register scripts/backfill-currency-awg.ts --apply
 *
 * Options:
 *   --apply        perform the writes (default is dry run)
 *   --to=XXX       target ISO code (default AWG — keep in step with the schema default)
 *   --from=XXX     legacy ISO code to replace (default AED)
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const APPLY = process.argv.includes("--apply");

function flag(name: string, fallback: string): string {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  const code = (raw ?? fallback).trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw new Error(`--${name} must be a 3-letter ISO code (got "${raw}")`);
  return code;
}

const FROM = flag("from", "AED");
const TO = flag("to", "AWG");

/**
 * Tables this script REWRITES. These are the three whose schema default moved
 * AED -> AWG, i.e. the ones whose stored value was written under the old assumption.
 */
const TARGETS = [
  { label: "Proposal", model: () => prisma.proposal },
  { label: "Order", model: () => prisma.order },
  { label: "Project", model: () => prisma.project },
] as const;

/**
 * Tables that also carry a `currency` column but are NOT rewritten. Counted only, so
 * the dry run surfaces anything unexpected. These default to USD (or, for
 * DevelopmentProject, already AWG) and were never part of the AED regression; if any
 * of them shows a non-zero AED count, that's a decision for a human, not this script.
 */
const SURVEY_ONLY = [
  { label: "ChangeOrder", model: () => prisma.changeOrder },
  { label: "ProgressCertification", model: () => prisma.progressCertification },
  { label: "DevelopmentProject", model: () => prisma.developmentProject },
  { label: "CostEstimate", model: () => prisma.costEstimate },
  { label: "PurchaseOrder", model: () => prisma.purchaseOrder },
  { label: "MaterialSelection", model: () => prisma.materialSelection },
  { label: "ServiceProposal", model: () => prisma.serviceProposal },
] as const;

// Narrow structural type: every model above exposes these two with a `currency` filter.
type CurrencyModel = {
  count(args: { where: { currency: string } }): Promise<number>;
  updateMany(args: { where: { currency: string }; data: { currency: string } }): Promise<{ count: number }>;
};

const pad = (s: string) => s.padEnd(24, " ");

async function main() {
  console.log(
    `Currency backfill  ${FROM} -> ${TO}   [${APPLY ? "APPLY — will write" : "DRY RUN — no writes"}]\n`,
  );

  // ── Before ────────────────────────────────────────────────────────────────
  console.log("BEFORE");
  const before: Record<string, { from: number; to: number }> = {};
  for (const t of TARGETS) {
    const m = t.model() as unknown as CurrencyModel;
    const from = await m.count({ where: { currency: FROM } });
    const to = await m.count({ where: { currency: TO } });
    before[t.label] = { from, to };
    console.log(`  ${pad(t.label)} ${FROM}: ${from}   ${TO}: ${to}`);
  }

  const candidates = Object.values(before).reduce((n, c) => n + c.from, 0);
  if (candidates === 0) {
    console.log(`\nNothing to do — no rows store "${FROM}" in the target tables.`);
  }

  // ── Write ─────────────────────────────────────────────────────────────────
  if (APPLY && candidates > 0) {
    console.log("\nUPDATING");
    for (const t of TARGETS) {
      const m = t.model() as unknown as CurrencyModel;
      const { count } = await m.updateMany({ where: { currency: FROM }, data: { currency: TO } });
      console.log(`  ${pad(t.label)} updated ${count}`);
    }
  } else if (!APPLY && candidates > 0) {
    console.log(`\nWould update ${candidates} row(s). Re-run with --apply to write.`);
  }

  // ── After ─────────────────────────────────────────────────────────────────
  if (APPLY) {
    console.log("\nAFTER");
    for (const t of TARGETS) {
      const m = t.model() as unknown as CurrencyModel;
      const from = await m.count({ where: { currency: FROM } });
      const to = await m.count({ where: { currency: TO } });
      const b = before[t.label];
      console.log(
        `  ${pad(t.label)} ${FROM}: ${b.from} -> ${from}   ${TO}: ${b.to} -> ${to}`,
      );
    }
  }

  // ── Survey (never written) ────────────────────────────────────────────────
  console.log(`\nSURVEY — other tables carrying "${FROM}" (NOT modified by this script)`);
  let strays = 0;
  for (const s of SURVEY_ONLY) {
    const m = s.model() as unknown as CurrencyModel;
    const from = await m.count({ where: { currency: FROM } });
    strays += from;
    console.log(`  ${pad(s.label)} ${FROM}: ${from}`);
  }
  const priceItems = await prisma.priceItem.count({ where: { currency: FROM } });
  console.log(
    `  ${pad("PriceItem")} ${FROM}: ${priceItems}   (intentionally left — real UAE supplier prices)`,
  );
  if (strays > 0) {
    console.log(
      `\n  ${strays} row(s) outside the target tables still store "${FROM}". Decide per table:` +
        `\n  they may be legitimate foreign-currency records, or leftovers worth converting by hand.`,
    );
  }

  console.log(APPLY ? "\nDone." : "\nDone (dry run — nothing was written).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
