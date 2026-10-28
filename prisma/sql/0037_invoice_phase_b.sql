-- 0037_invoice_phase_b.sql
--
-- Invoicing Phase B (0.38.0): invoices emailed with their PDF (a SENT status
-- and who it was sent to), re-issuing a void invoice as "<number>-2", numbered
-- payment receipts (RCT-YYYY-NNN), payment reversal with a reason, and a
-- discount before tax. No new table: one new enum value, one new enum, new
-- columns on "invoices" and "invoice_payments", and a backfill of receipt
-- numbers for the payments already recorded.
--
-- APPLY BEFORE MERGING the PR that adds it — every invoice screen, the
-- register, receivables, the finance overview and the Stripe webhook read
-- these columns through Prisma, so deploying the code first makes the whole
-- finance module fail.
--
-- Numbered 0037, after 0036_api_tokens.sql. It touches only "invoices" and
-- "invoice_payments" (both @@map'd) and may be applied in any order relative
-- to branches in review that do not.
--
-- Purely additive: nothing that already exists is changed or dropped, so it is
-- safe to run against a live database and before the code reaches production.
-- It is also safe to run twice — every statement is guarded (IF NOT EXISTS, a
-- catalogue check for the new enum, `ADD VALUE IF NOT EXISTS` for the new enum
-- value), and the backfill only touches rows whose "receiptNumber" is still
-- NULL, so a second run changes nothing.
--
-- 'SENT' IS ADDED, NOT USED, HERE. Postgres lets ALTER TYPE ... ADD VALUE run
-- inside the transaction scripts/apply-sql.mjs opens, but the new value cannot
-- be used in that same transaction — nothing below does. Existing invoices
-- keep the status they have; an invoice becomes SENT only when the app emails
-- it and the mail provider confirms.
--
-- RECEIPT NUMBERS FOR EXISTING PAYMENTS, deterministically. Per practice, the
-- payments with no number are numbered in the order they were received
-- ("paidAt", then "createdAt", then "id" so two payments on one day always
-- come out the same way), continuing after the highest receipt number that
-- practice already has, as RCT-<year the payment was received>-<NNN> — the
-- same series the app continues from (lib/finance/calc.ts, nextReceiptNumber).
-- The app also numbers, the first time its receipt is opened, any payment
-- this backfill did not reach (one inserted between this file and the deploy).
-- The unique index is created AFTER the backfill, so the backfill can never be
-- refused half-way by a number it is itself writing.
--
-- NO FOREIGN KEYS are added. "reissuedFromId" is a loose link to the void
-- invoice, like "serviceProposalId": the void invoice is never deleted (only
-- drafts are, softly), and a hard constraint would add nothing but a lock.
--
-- Generated with:
--   npx prisma migrate diff --from-schema <HEAD>.prisma --to-schema prisma/schema.prisma --script
-- and reviewed by hand. Rehearsed against a local Postgres (embedded-postgres)
-- pushed from HEAD's schema with payments in it: applied twice (the second run
-- is a no-op), and `prisma migrate diff` from that database to the new schema
-- is empty afterwards. Apply with:
--   node scripts/apply-sql.mjs prisma/sql/0037_invoice_phase_b.sql
--   node scripts/verify-data-api-lockdown.mjs

-- AlterEnum
-- Between ISSUED and PART_PAID, where it sits in an invoice's life.
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'SENT' AFTER 'ISSUED';

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvoiceDiscountType') THEN
    CREATE TYPE "InvoiceDiscountType" AS ENUM ('PERCENT', 'AMOUNT');
  END IF;
END $$;

-- AlterTable: invoices — discount (before tax), sent stamp, re-issue link.
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "discountType" "InvoiceDiscountType";
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "discountValue" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "discountTotal" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "sentTo" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "sentByName" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "sentCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "reissuedFromId" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "reissuedFromNumber" TEXT;

-- AlterTable: invoice_payments — receipt number and reversal.
ALTER TABLE "invoice_payments" ADD COLUMN IF NOT EXISTS "receiptNumber" TEXT;
ALTER TABLE "invoice_payments" ADD COLUMN IF NOT EXISTS "reversedAt" TIMESTAMP(3);
ALTER TABLE "invoice_payments" ADD COLUMN IF NOT EXISTS "reversedById" TEXT;
ALTER TABLE "invoice_payments" ADD COLUMN IF NOT EXISTS "reversedByName" TEXT;
ALTER TABLE "invoice_payments" ADD COLUMN IF NOT EXISTS "reverseReason" TEXT;

-- Backfill: number every payment that has no receipt number yet (see the
-- header). The number part is padded to three digits and never truncated, as
-- JavaScript's padStart does.
WITH highest AS (
  SELECT "companyId",
         MAX(COALESCE(SUBSTRING("receiptNumber" FROM '(\d+)\s*$')::INTEGER, 0)) AS "top"
  FROM "invoice_payments"
  WHERE "receiptNumber" IS NOT NULL
  GROUP BY "companyId"
),
numbered AS (
  SELECT p."id",
         EXTRACT(YEAR FROM p."paidAt")::INTEGER AS "year",
         COALESCE(h."top", 0)
           + ROW_NUMBER() OVER (
               PARTITION BY p."companyId"
               ORDER BY p."paidAt", p."createdAt", p."id"
             ) AS "n"
  FROM "invoice_payments" p
  LEFT JOIN highest h ON h."companyId" IS NOT DISTINCT FROM p."companyId"
  WHERE p."receiptNumber" IS NULL
)
UPDATE "invoice_payments" AS p
SET "receiptNumber" = 'RCT-' || n."year" || '-' ||
      CASE WHEN n."n" < 1000 THEN LPAD(n."n"::TEXT, 3, '0') ELSE n."n"::TEXT END
FROM numbered n
WHERE p."id" = n."id" AND p."receiptNumber" IS NULL;

-- CreateIndex
-- A receipt number is unique within a practice — the guarantee the app's
-- allocation relies on as its last line of defence.
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_payments_companyId_receiptNumber_key" ON "invoice_payments"("companyId", "receiptNumber");
-- "Re-issued as …" on the void invoice: its re-issues, looked up by this link.
CREATE INDEX IF NOT EXISTS "invoices_companyId_reissuedFromId_idx" ON "invoices"("companyId", "reissuedFromId");

-- No new table, so nothing new to lock out of the Data API: "invoices" and
-- "invoice_payments" already have RLS on and no anon/authenticated grants
-- (0016, 0012). New columns inherit the table's policies.
