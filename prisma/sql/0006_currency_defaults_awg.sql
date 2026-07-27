-- 0006_currency_defaults_awg.sql
-- System Currency fix (commit 53a180a): the org unit is AWG, but Proposal/Order/Project
-- still defaulted to the hardcoded UAE 'AED'. Verified byte-for-byte against
-- `prisma migrate diff --from-schema <pre-53a180a schema> --to-schema prisma/schema.prisma --script`.
--
-- DEFAULTS ONLY — this changes nothing about rows that already exist. Records written
-- before the fix still store the literal 'AED'; converting those is a separate, opt-in
-- step: scripts/backfill-currency-awg.ts (dry run by default). See docs/CURRENCY.md.
--
-- Recorded as applied to zouzxwuojnsyjvadvldr on 2026-07-25 (see commit 53a180a).
-- Re-running is harmless: SET DEFAULT is idempotent.

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "currency" SET DEFAULT 'AWG';

-- AlterTable
ALTER TABLE "Project" ALTER COLUMN "currency" SET DEFAULT 'AWG';

-- AlterTable
ALTER TABLE "Proposal" ALTER COLUMN "currency" SET DEFAULT 'AWG';

