-- 0014_building_permits.sql
--
-- Building Permit module (Module 1 — Architecture & Engineering Design).
-- Purely additive: six new tables and seven new enums. It touches nothing that
-- already exists, so it is safe to run against a live database.
--
-- Numbered after 0013 because it is applied after it. (A draft of this file sat
-- in working trees as 0011 but was never applied anywhere.)
--
-- A letter's PDF is a building_permit_documents row with "correspondenceId" set.
--
-- Generated with:
--   npx prisma migrate diff --from-schema <main>.prisma --to-schema prisma/schema.prisma --script
-- and reviewed by hand. Apply with:
--   node scripts/apply-sql.mjs prisma/sql/0014_building_permits.sql
--   node scripts/verify-data-api-lockdown.mjs

-- CreateEnum
CREATE TYPE "BuildingPermitType" AS ENUM ('NEW_BUILD', 'RENOVATION', 'EXTENSION', 'DEMOLITION', 'CHANGE_OF_USE', 'FENCE_WALL', 'POOL', 'SIGNAGE', 'TEMPORARY', 'SPLIT_PARCEL', 'OTHER');

-- CreateEnum
CREATE TYPE "BuildingPermitStatus" AS ENUM ('DRAFT', 'PREPARING', 'SUBMITTED', 'IN_REVIEW', 'INFO_REQUESTED', 'CONCEPT_APPROVED', 'RESUBMITTED', 'APPROVED', 'APPROVED_WITH_CONDITIONS', 'REJECTED', 'WITHDRAWN', 'ISSUED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BuildingPermitSubmissionMethod" AS ENUM ('COUNTER', 'EMAIL', 'PORTAL', 'COURIER', 'OTHER');

-- CreateEnum
CREATE TYPE "BuildingPermitCorrespondenceDirection" AS ENUM ('INCOMING', 'OUTGOING');

-- CreateEnum
CREATE TYPE "BuildingPermitApprovalStage" AS ENUM ('CONCEPT', 'ZONING', 'TECHNICAL', 'FIRE', 'HEALTH', 'UTILITIES', 'FINAL', 'OTHER');

-- CreateEnum
CREATE TYPE "BuildingPermitApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'APPROVED_WITH_CONDITIONS', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "BuildingPermitDocumentCategory" AS ENUM ('APPLICATION_FORM', 'DRAWING', 'CALCULATION', 'LETTER', 'MINUTES', 'APPROVAL', 'PHOTO', 'RECEIPT', 'OTHER');

-- CreateTable
CREATE TABLE "building_permits" (
    "companyId" TEXT,
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "permitNumber" TEXT,
    "title" TEXT NOT NULL,
    "permitType" "BuildingPermitType" NOT NULL DEFAULT 'NEW_BUILD',
    "status" "BuildingPermitStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "projectId" TEXT,
    "projectName" TEXT,
    "clientId" TEXT,
    "clientName" TEXT,
    "applicantName" TEXT,
    "siteAddress" TEXT,
    "parcelNumber" TEXT,
    "landRegistry" TEXT,
    "authority" TEXT,
    "authorityContact" TEXT,
    "authorityEmail" TEXT,
    "lotAreaM2" DECIMAL(65,30),
    "builtAreaM2" DECIMAL(65,30),
    "estimatedValue" DECIMAL(65,30),
    "currency" TEXT NOT NULL DEFAULT 'AWG',
    "submittedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "conceptApprovalAt" TIMESTAMP(3),
    "conceptApprovalRef" TEXT,
    "decisionAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "targetDecisionAt" TIMESTAMP(3),
    "feeAmount" DECIMAL(65,30),
    "feePaidAt" TIMESTAMP(3),
    "responsibleId" TEXT,
    "responsibleName" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "building_permits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "building_permit_submissions" (
    "companyId" TEXT,
    "id" TEXT NOT NULL,
    "permitId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "method" "BuildingPermitSubmissionMethod" NOT NULL DEFAULT 'COUNTER',
    "receivedBy" TEXT,
    "receiptNumber" TEXT,
    "contents" TEXT,
    "notes" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "building_permit_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "building_permit_meetings" (
    "companyId" TEXT,
    "id" TEXT NOT NULL,
    "permitId" TEXT NOT NULL,
    "heldAt" TIMESTAMP(3) NOT NULL,
    "subject" TEXT NOT NULL,
    "location" TEXT,
    "attendees" TEXT,
    "minutes" TEXT,
    "decisions" TEXT,
    "followUp" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "building_permit_meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "building_permit_correspondence" (
    "companyId" TEXT,
    "id" TEXT NOT NULL,
    "permitId" TEXT NOT NULL,
    "direction" "BuildingPermitCorrespondenceDirection" NOT NULL DEFAULT 'INCOMING',
    "letterRef" TEXT,
    "party" TEXT,
    "subject" TEXT NOT NULL,
    "letterDate" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "summary" TEXT,
    "requiresResponse" BOOLEAN NOT NULL DEFAULT false,
    "responseDueAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "building_permit_correspondence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "building_permit_approvals" (
    "companyId" TEXT,
    "id" TEXT NOT NULL,
    "permitId" TEXT NOT NULL,
    "stage" "BuildingPermitApprovalStage" NOT NULL DEFAULT 'CONCEPT',
    "status" "BuildingPermitApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "refNumber" TEXT,
    "validUntil" TIMESTAMP(3),
    "conditions" TEXT,
    "notes" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "building_permit_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "building_permit_documents" (
    "companyId" TEXT,
    "id" TEXT NOT NULL,
    "permitId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "BuildingPermitDocumentCategory" NOT NULL DEFAULT 'OTHER',
    "storageKey" TEXT,
    "externalUrl" TEXT,
    "filename" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "documentDate" TIMESTAMP(3),
    "uploadedByName" TEXT,
    "notes" TEXT,
    "correspondenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "building_permit_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "building_permits_companyId_status_idx" ON "building_permits"("companyId", "status");

-- CreateIndex
CREATE INDEX "building_permits_companyId_projectId_idx" ON "building_permits"("companyId", "projectId");

-- CreateIndex
CREATE INDEX "building_permits_companyId_submittedAt_idx" ON "building_permits"("companyId", "submittedAt");

-- CreateIndex
CREATE INDEX "building_permits_companyId_createdAt_idx" ON "building_permits"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "building_permits_companyId_reference_key" ON "building_permits"("companyId", "reference");

-- CreateIndex
CREATE INDEX "building_permit_submissions_companyId_permitId_idx" ON "building_permit_submissions"("companyId", "permitId");

-- CreateIndex
CREATE INDEX "building_permit_meetings_companyId_permitId_idx" ON "building_permit_meetings"("companyId", "permitId");

-- CreateIndex
CREATE INDEX "building_permit_correspondence_companyId_permitId_idx" ON "building_permit_correspondence"("companyId", "permitId");

-- CreateIndex
CREATE INDEX "building_permit_correspondence_companyId_responseDueAt_idx" ON "building_permit_correspondence"("companyId", "responseDueAt");

-- CreateIndex
CREATE INDEX "building_permit_approvals_companyId_permitId_idx" ON "building_permit_approvals"("companyId", "permitId");

-- CreateIndex
CREATE INDEX "building_permit_documents_companyId_permitId_idx" ON "building_permit_documents"("companyId", "permitId");

-- CreateIndex
CREATE INDEX "building_permit_documents_companyId_category_idx" ON "building_permit_documents"("companyId", "category");

-- CreateIndex
CREATE INDEX "building_permit_documents_correspondenceId_idx" ON "building_permit_documents"("correspondenceId");

-- AddForeignKey
ALTER TABLE "building_permit_submissions" ADD CONSTRAINT "building_permit_submissions_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "building_permits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "building_permit_meetings" ADD CONSTRAINT "building_permit_meetings_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "building_permits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "building_permit_correspondence" ADD CONSTRAINT "building_permit_correspondence_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "building_permits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "building_permit_approvals" ADD CONSTRAINT "building_permit_approvals_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "building_permits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "building_permit_documents" ADD CONSTRAINT "building_permit_documents_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "building_permits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "building_permit_documents" ADD CONSTRAINT "building_permit_documents_correspondenceId_fkey" FOREIGN KEY ("correspondenceId") REFERENCES "building_permit_correspondence"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Keep the Data API locked out (see 0012).
ALTER TABLE "building_permits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "building_permit_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "building_permit_meetings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "building_permit_correspondence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "building_permit_approvals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "building_permit_documents" ENABLE ROW LEVEL SECURITY;
