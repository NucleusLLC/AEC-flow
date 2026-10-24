-- 0032_invoice_second_tax.sql
--
-- Finance: an invoice (and so a credit note) may carry a SECOND tax — Aruba's
-- BBO and BAVP on the same invoice. Three new columns on "invoices" and the
-- same three on "credit_notes".
--
-- APPLY BEFORE MERGING the PR that adds it — Prisma selects every column of
-- the model, so once the code reaches production every invoice and credit-note
-- read (the register, invoice and credit-note pages, receivables, the
-- Statement of Account, the tax report and the accounting export) fails until
-- these columns exist.
--
-- Purely additive: nothing that already exists is changed or dropped, so it is
-- safe to run against a live database and safe to run before the code that
-- uses it reaches production. It is also safe to run twice — every statement
-- is ADD COLUMN IF NOT EXISTS.
--
-- EXISTING ROWS ARE NOT TOUCHED. An issued invoice is immutable: the new
-- columns default to "no second tax" (NULL name, 0 percent, 0 amount), which is
-- exactly what every invoice and credit note raised before this carried, so
-- each one keeps its stored figures and prints exactly as before. There is no
-- backfill.
--
-- WHAT THE COLUMNS MEAN. "tax2Name" / "tax2Percent" are a snapshot like
-- "taxName" / "taxPercent", in the same "taxMode". The second tax is charged on
-- the same taxable subtotal as the first, never on the first tax (no
-- compounding). "taxTotal" stays the FIRST tax only; "tax2Total" is the second;
-- for EXCLUSIVE tax "total" = "subtotal" + "taxTotal" + "tax2Total". See
-- lib/finance/calc.ts (`invoiceTotals`) for the INCLUSIVE split. Money columns
-- are DECIMAL, never float.
--
-- No new table, so no new RLS statement: both tables were locked out of the
-- Data API by the migrations that created them (0016, 0030).
--
-- Written by hand to match prisma/schema.prisma (models Invoice, CreditNote).
-- Apply with:
--   node scripts/apply-sql.mjs prisma/sql/0032_invoice_second_tax.sql

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "tax2Name" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "tax2Percent" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "tax2Total" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "credit_notes" ADD COLUMN IF NOT EXISTS "tax2Name" TEXT;
ALTER TABLE "credit_notes" ADD COLUMN IF NOT EXISTS "tax2Percent" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "credit_notes" ADD COLUMN IF NOT EXISTS "tax2Total" DECIMAL(65,30) NOT NULL DEFAULT 0;
