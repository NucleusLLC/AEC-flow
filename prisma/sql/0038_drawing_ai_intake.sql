-- 0038_drawing_ai_intake.sql
--
-- Drawing intake, Autodesk-Construction-Cloud style: a dropped set is split
-- into one sheet per page, and a model reads each page's title block — sheet
-- number, title and kind of drawing, revision and its date, and who drew it.
-- Four nullable columns on "drawings"; no new table, no new type.
--
--   "architect", "engineer"   The consultant names as the title block prints
--                             them, confirmed by the user before saving.
--   "setFilename", "setPage"  Which page of which uploaded set a sheet was,
--                             when it came out of a split. Evidence only.
--
-- APPLY BEFORE MERGING the PR that adds it — every drawing insert names the
-- new columns, so deploying the code first makes every upload fail.
--
-- Numbered 0038, after 0037_invoice_phase_b.sql. Independent of every earlier
-- file and of every branch in review.
--
-- Purely additive: nothing that already exists is changed or dropped, so it is
-- safe to run against a live database and before the code reaches production.
-- Safe to run twice — every statement is guarded (IF NOT EXISTS).
--
-- Generated with:
--   npx prisma migrate diff --from-schema <HEAD>.prisma --to-schema prisma/schema.prisma --script
-- and reviewed by hand. Apply with:
--   node scripts/apply-sql.mjs prisma/sql/0038_drawing_ai_intake.sql
--   node scripts/verify-data-api-lockdown.mjs

-- AlterTable
ALTER TABLE "drawings" ADD COLUMN IF NOT EXISTS "architect" TEXT;
ALTER TABLE "drawings" ADD COLUMN IF NOT EXISTS "engineer" TEXT;
ALTER TABLE "drawings" ADD COLUMN IF NOT EXISTS "setFilename" TEXT;
ALTER TABLE "drawings" ADD COLUMN IF NOT EXISTS "setPage" INTEGER;
