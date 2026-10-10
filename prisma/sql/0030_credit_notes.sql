-- 0030_credit_notes.sql
--
-- Finance: credit notes. Two new tables, one new enum, and one new value on an
-- existing enum.
--
-- APPLY BEFORE MERGING the PR that adds it — the invoice register, invoice
-- pages, receivables and the Statement of Account all read "credit_notes", so
-- deploying the code first makes the finance pages fail.
--
-- Numbered 0030: it was written as 0025, but 0026–0029 were taken on main
-- while it waited. Independent of all of them; may be applied in any order.
--
-- Purely additive: nothing that already exists is changed or dropped, so it is
-- safe to run against a live database and safe to run before the code that
-- uses it reaches production. It is also safe to run twice — every statement
-- is guarded (IF NOT EXISTS, or a catalogue check for the ones Postgres has no
-- IF NOT EXISTS for).
--
-- A CREDIT NOTE NEVER EDITS ITS INVOICE. The invoice stays exactly what the
-- client was sent; the credit note is a second document that reduces what the
-- invoice still owes, and only once it is ISSUED (lib/finance/calc.ts,
-- `invoiceBalance`). The client, currency and tax are snapshotted from the
-- invoice when the credit note is raised. Money columns are DECIMAL, never
-- float.
--
-- "InvoiceStatus" GAINS 'CREDITED'. It is a DERIVED status — an invoice settled
-- by credit notes with nothing received — and nothing ever writes it to the
-- column. It is in the enum so the schema and the client-safe union in
-- lib/finance/types.ts stay one list (lib/finance/enums.test.ts). Added BEFORE
-- 'VOID' so the type's order matches prisma/schema.prisma.
--
-- TABLE NAMES. "credit_notes" and "credit_note_lines" are @@map'd snake_case,
-- like "invoices", which is the only existing table referenced here (the
-- foreign key). "User" — the one PascalCase table — is not touched.
--
-- Generated with:
--   npx prisma migrate diff --from-schema <main>.prisma --to-schema prisma/schema.prisma --script
-- and reviewed by hand. Rehearsed against a local copy of production's schema
-- (origin/main) before being committed. Apply with:
--   node scripts/apply-sql.mjs prisma/sql/0030_credit_notes.sql
--   node scripts/verify-data-api-lockdown.mjs

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CreditNoteStatus') THEN
    CREATE TYPE "CreditNoteStatus" AS ENUM ('DRAFT', 'ISSUED', 'VOID');
  END IF;
END $$;

-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'CREDITED' BEFORE 'VOID';

-- CreateTable
CREATE TABLE IF NOT EXISTS "credit_notes" (
    "companyId" TEXT,
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "CreditNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "invoiceId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AWG',
    "clientId" TEXT,
    "clientName" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "billingAddress" TEXT,
    "projectId" TEXT,
    "projectName" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "taxName" TEXT,
    "taxPercent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxMode" "TaxMode" NOT NULL DEFAULT 'EXCLUSIVE',
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxableSubtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "updatedById" TEXT,
    "issuedByName" TEXT,
    "issuedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "credit_note_lines" (
    "companyId" TEXT,
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "invoiceLineId" TEXT,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_note_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "credit_notes_companyId_status_idx" ON "credit_notes"("companyId", "status");
CREATE INDEX IF NOT EXISTS "credit_notes_companyId_invoiceId_idx" ON "credit_notes"("companyId", "invoiceId");
CREATE INDEX IF NOT EXISTS "credit_notes_companyId_clientId_idx" ON "credit_notes"("companyId", "clientId");
CREATE INDEX IF NOT EXISTS "credit_notes_companyId_date_idx" ON "credit_notes"("companyId", "date");
-- One CN-YYYY-NNN per practice. (Only enforced where companyId is set; every
-- in-app write carries one, stamped by the tenant extension in lib/db.ts.)
CREATE UNIQUE INDEX IF NOT EXISTS "credit_notes_companyId_number_key" ON "credit_notes"("companyId", "number");
CREATE INDEX IF NOT EXISTS "credit_note_lines_companyId_creditNoteId_idx" ON "credit_note_lines"("companyId", "creditNoteId");
CREATE INDEX IF NOT EXISTS "credit_note_lines_companyId_invoiceLineId_idx" ON "credit_note_lines"("companyId", "invoiceLineId");

-- AddForeignKey
-- RESTRICT, deliberately: a credited invoice is a record and so is its credit.
-- Invoices are only ever soft-deleted in the app, so this never fires there;
-- it stops a hand-run DELETE from orphaning a credit note.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credit_notes_invoiceId_fkey') THEN
    ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_invoiceId_fkey"
      FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credit_note_lines_creditNoteId_fkey') THEN
    ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_creditNoteId_fkey"
      FOREIGN KEY ("creditNoteId") REFERENCES "credit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;


-- Keep the Data API locked out (see 0012). A credit note says how much of a
-- practice's billing it gave back, to whom and why — one practice's credits
-- must never be readable over /rest/v1, by anyone. RLS on with NO policies
-- denies anon/authenticated everything and leaves `postgres` (Prisma) and the
-- service role untouched.
ALTER TABLE "credit_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "credit_note_lines" ENABLE ROW LEVEL SECURITY;

-- And no grants either, belt and braces with 0012's default privileges. The
-- roles only exist on Supabase, so a plain Postgres (a local rehearsal) skips
-- this rather than failing the whole file.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "credit_notes", "credit_note_lines" FROM anon, authenticated;
  END IF;
END $$;
