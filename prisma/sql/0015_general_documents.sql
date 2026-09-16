-- 0015_general_documents.sql
--
-- General Documents: the letters and instruments a practice writes around a
-- project but outside any one system — power of attorney, letter of intent,
-- NDA, RFI, RFQ, notices, transmittals. One new table and one new enum.
--
-- Purely additive: it touches nothing that already exists, so it is safe to run
-- against a live database.
--
-- The row stores the finished text (body) and what was typed (values); the
-- catalogue key in "docType" is provenance, not a link a later template edit
-- could rewrite.
--
-- Generated with:
--   npx prisma migrate diff --from-schema <main>.prisma --to-schema prisma/schema.prisma --script
-- and reviewed by hand. Apply with:
--   node scripts/apply-sql.mjs prisma/sql/0015_general_documents.sql
--   node scripts/verify-data-api-lockdown.mjs

-- CreateEnum
CREATE TYPE "GeneralDocumentStatus" AS ENUM ('DRAFT', 'ISSUED', 'SIGNED', 'SUPERSEDED', 'VOID');

-- CreateTable
CREATE TABLE "general_documents" (
    "companyId" TEXT,
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "status" "GeneralDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "reference" TEXT,
    "subject" TEXT,
    "clientId" TEXT,
    "clientName" TEXT,
    "projectId" TEXT,
    "projectName" TEXT,
    "counterpartyName" TEXT,
    "counterpartyAddress" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "issueDate" TIMESTAMP(3),
    "effectiveDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "values" JSONB,
    "body" TEXT[],
    "notes" TEXT,
    "supersedesId" TEXT,
    "voidReason" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "issuedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "general_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "general_documents_companyId_status_idx" ON "general_documents"("companyId", "status");

-- CreateIndex
CREATE INDEX "general_documents_companyId_docType_idx" ON "general_documents"("companyId", "docType");

-- CreateIndex
CREATE INDEX "general_documents_companyId_projectId_idx" ON "general_documents"("companyId", "projectId");

-- CreateIndex
CREATE INDEX "general_documents_companyId_clientId_idx" ON "general_documents"("companyId", "clientId");

-- CreateIndex
CREATE INDEX "general_documents_companyId_issueDate_idx" ON "general_documents"("companyId", "issueDate");

-- CreateIndex
CREATE UNIQUE INDEX "general_documents_companyId_number_key" ON "general_documents"("companyId", "number");


-- Keep the Data API locked out (see 0012). A power of attorney names a client:
-- this table must never be readable over /rest/v1.
ALTER TABLE "general_documents" ENABLE ROW LEVEL SECURITY;
