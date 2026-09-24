-- 0023_construction_contracts.sql
--
-- The Construction Contract Generator: the practice's own contract templates,
-- and the contracts generated from them. Two new tables, one new enum.
--
-- Purely additive: it touches nothing that already exists, so it is safe to run
-- against a live database and safe to run before the code reaches production.
--
-- THE DOCUMENT IS JSONB, NOT HTML. `body` holds the contract as structure —
-- title, parties, recitals, numbered articles, payment schedule, signatures —
-- and the typesetting is a render of it (docs/contracts/PLAN.md). A contract
-- stored as HTML freezes the letterhead of the day it was made; a contract
-- stored as structure re-typesets with the practice's current one.
--
-- MONEY IS DECIMAL, never float, and the instalment figures inside `body` are
-- computed in integer cents by lib/contracts/schedule.ts before the row is
-- written. The model is told the numbers and never asked for one.
--
-- Numbered 0023 because 0022 is the Drawing Studio. Independent of it.
--
-- Apply with:
--   node scripts/apply-sql.mjs prisma/sql/0023_construction_contracts.sql
--   node scripts/verify-data-api-lockdown.mjs

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ISSUED', 'SIGNED', 'SUPERSEDED', 'VOID');

-- CreateTable
CREATE TABLE "contract_templates" (
    "companyId" TEXT,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "storageKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "uploadedById" TEXT,
    "uploadedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "contract_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "construction_contracts" (
    "companyId" TEXT,
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "projectId" TEXT,
    "projectName" TEXT NOT NULL,
    "projectNumber" TEXT,
    "templateId" TEXT,
    "templateName" TEXT,
    "employerName" TEXT NOT NULL,
    "contractorName" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AWG',
    "contractSum" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "exchangeRate" DECIMAL(65,30) NOT NULL DEFAULT 1.75,
    "facts" JSONB NOT NULL,
    "body" JSONB NOT NULL,
    "modelNotes" JSONB,
    "modelId" TEXT,
    "generatedAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "supersedesId" TEXT,
    "voidReason" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "construction_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contract_templates_companyId_archivedAt_idx" ON "contract_templates"("companyId", "archivedAt");
CREATE UNIQUE INDEX "construction_contracts_companyId_number_key" ON "construction_contracts"("companyId", "number");
CREATE INDEX "construction_contracts_companyId_status_idx" ON "construction_contracts"("companyId", "status");
CREATE INDEX "construction_contracts_companyId_projectId_idx" ON "construction_contracts"("companyId", "projectId");
CREATE INDEX "construction_contracts_companyId_createdAt_idx" ON "construction_contracts"("companyId", "createdAt");

-- AddForeignKey
-- ON DELETE SET NULL, deliberately: a template may be retired, and a contract
-- generated from it must still read. The template NAME is snapshotted on the
-- contract for exactly this reason.
ALTER TABLE "construction_contracts" ADD CONSTRAINT "construction_contracts_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "contract_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Keep the Data API locked out (see 0012). A construction contract carries the
-- price of a job and the names of both parties to it — one practice's contracts
-- must never be readable over /rest/v1, by anyone.
ALTER TABLE "contract_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "construction_contracts" ENABLE ROW LEVEL SECURITY;
