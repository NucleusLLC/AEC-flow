-- CreateEnum
CREATE TYPE "ServiceProposalKind" AS ENUM ('QUICK', 'ADVANCED');

-- CreateEnum
CREATE TYPE "ServiceProposalStatus" AS ENUM ('DRAFT', 'INTERNAL_REVIEW', 'APPROVED_FOR_ISSUE', 'SENT', 'UNDER_CLIENT_REVIEW', 'REVISION_REQUESTED', 'REVISED', 'ACCEPTED', 'PARTIALLY_ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN', 'SUPERSEDED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "CostBasisType" AS ENUM ('ESTIMATED_CONSTRUCTION_COST', 'APPROVED_CONSTRUCTION_BUDGET', 'CONTRACTOR_CONTRACT_SUM', 'TOTAL_DEVELOPMENT_COST', 'CONSTRUCTION_EXCL_LAND', 'CONSTRUCTION_EXCL_FFE', 'CONSTRUCTION_EXCL_EQUIPMENT', 'CONSTRUCTION_EXCL_TAXES', 'CONSTRUCTION_EXCL_FINANCING', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FeeMethod" AS ENUM ('PERCENT_OF_BASIS', 'FIXED', 'HOURLY', 'PER_AREA', 'PER_UNIT', 'PER_DELIVERABLE', 'RETAINER', 'MONTHLY', 'MILESTONE', 'COST_PLUS', 'SUBCONSULTANT_PLUS_MARKUP');

-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('BASE', 'OPTIONAL', 'ADDITIONAL');

-- CreateEnum
CREATE TYPE "TaxMode" AS ENUM ('EXCLUSIVE', 'INCLUSIVE');

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "serviceProposalId" TEXT;

-- CreateTable
CREATE TABLE "service_proposals" (
    "companyId" TEXT,
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "ServiceProposalKind" NOT NULL DEFAULT 'QUICK',
    "status" "ServiceProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "versionLabel" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "clientId" TEXT,
    "clientName" TEXT,
    "projectId" TEXT,
    "projectName" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactTitle" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "languageCode" TEXT,
    "taxJurisdiction" TEXT,
    "costBasisType" "CostBasisType",
    "costBasisAmount" DECIMAL(65,30),
    "costBasisSourceId" TEXT,
    "costBasisSourceField" TEXT,
    "costBasisCapturedAt" TIMESTAMP(3),
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxableSubtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "baseFeeTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "optionalServicesTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "reimbursablesTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "retainerAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "scopeSummary" TEXT,
    "exclusions" TEXT,
    "assumptions" TEXT,
    "terms" TEXT,
    "estimatedWeeks" INTEGER,
    "showFeeDerivation" BOOLEAN NOT NULL DEFAULT true,
    "documentStructure" JSONB,
    "issuedAt" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "preparedById" TEXT,
    "reviewedById" TEXT,
    "approvedById" TEXT,
    "ownerId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "service_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_proposal_disciplines" (
    "companyId" TEXT,
    "id" TEXT NOT NULL,
    "serviceProposalId" TEXT NOT NULL,
    "disciplineKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "leadName" TEXT,
    "scope" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "service_proposal_disciplines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_proposal_phases" (
    "companyId" TEXT,
    "id" TEXT NOT NULL,
    "serviceProposalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "service_proposal_phases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_proposal_fee_components" (
    "companyId" TEXT,
    "id" TEXT NOT NULL,
    "serviceProposalId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "disciplineKey" TEXT,
    "method" "FeeMethod" NOT NULL,
    "category" "ServiceCategory" NOT NULL DEFAULT 'BASE',
    "percent" DECIMAL(65,30),
    "fixedAmount" DECIMAL(65,30),
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "calculatedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "overrideAmount" DECIMAL(65,30),
    "overrideReason" TEXT,
    "overrideById" TEXT,
    "overrideAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "service_proposal_fee_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_proposal_development_cost_items" (
    "companyId" TEXT,
    "id" TEXT NOT NULL,
    "serviceProposalId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "includedInBasis" BOOLEAN NOT NULL DEFAULT true,
    "isProfessionalFees" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "service_proposal_development_cost_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_proposal_payment_milestones" (
    "companyId" TEXT,
    "id" TEXT NOT NULL,
    "serviceProposalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" TEXT,
    "percent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "invoiceDescription" TEXT,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "service_proposal_payment_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_proposal_reimbursables" (
    "companyId" TEXT,
    "id" TEXT NOT NULL,
    "serviceProposalId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "method" TEXT,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "service_proposal_reimbursables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_proposal_discounts" (
    "companyId" TEXT,
    "id" TEXT NOT NULL,
    "serviceProposalId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "reason" TEXT,
    "authorisedById" TEXT,
    "authorisedAt" TIMESTAMP(3),
    "visibleToClient" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "service_proposal_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_proposal_taxes" (
    "companyId" TEXT,
    "id" TEXT NOT NULL,
    "serviceProposalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "mode" "TaxMode" NOT NULL DEFAULT 'EXCLUSIVE',
    "registrationNumber" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "service_proposal_taxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_proposal_status_history" (
    "companyId" TEXT,
    "id" TEXT NOT NULL,
    "serviceProposalId" TEXT NOT NULL,
    "fromStatus" "ServiceProposalStatus",
    "toStatus" "ServiceProposalStatus" NOT NULL,
    "reason" TEXT,
    "byId" TEXT,
    "byName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_proposal_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_proposal_versions" (
    "companyId" TEXT,
    "id" TEXT NOT NULL,
    "serviceProposalId" TEXT NOT NULL,
    "versionLabel" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "documentUrl" TEXT,
    "reason" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_proposal_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_rates" (
    "companyId" TEXT,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "mode" "TaxMode" NOT NULL DEFAULT 'EXCLUSIVE',
    "registrationNumber" TEXT,
    "jurisdiction" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_proposals_companyId_status_idx" ON "service_proposals"("companyId", "status");

-- CreateIndex
CREATE INDEX "service_proposals_companyId_clientId_idx" ON "service_proposals"("companyId", "clientId");

-- CreateIndex
CREATE INDEX "service_proposals_companyId_projectId_idx" ON "service_proposals"("companyId", "projectId");

-- CreateIndex
CREATE INDEX "service_proposals_companyId_createdAt_idx" ON "service_proposals"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "service_proposals_companyId_number_key" ON "service_proposals"("companyId", "number");

-- CreateIndex
CREATE INDEX "service_proposal_disciplines_serviceProposalId_idx" ON "service_proposal_disciplines"("serviceProposalId");

-- CreateIndex
CREATE INDEX "service_proposal_phases_serviceProposalId_idx" ON "service_proposal_phases"("serviceProposalId");

-- CreateIndex
CREATE INDEX "service_proposal_fee_components_serviceProposalId_idx" ON "service_proposal_fee_components"("serviceProposalId");

-- CreateIndex
CREATE INDEX "service_proposal_development_cost_items_serviceProposalId_idx" ON "service_proposal_development_cost_items"("serviceProposalId");

-- CreateIndex
CREATE INDEX "service_proposal_payment_milestones_serviceProposalId_idx" ON "service_proposal_payment_milestones"("serviceProposalId");

-- CreateIndex
CREATE INDEX "service_proposal_reimbursables_serviceProposalId_idx" ON "service_proposal_reimbursables"("serviceProposalId");

-- CreateIndex
CREATE INDEX "service_proposal_discounts_serviceProposalId_idx" ON "service_proposal_discounts"("serviceProposalId");

-- CreateIndex
CREATE INDEX "service_proposal_taxes_serviceProposalId_idx" ON "service_proposal_taxes"("serviceProposalId");

-- CreateIndex
CREATE INDEX "service_proposal_status_history_serviceProposalId_createdAt_idx" ON "service_proposal_status_history"("serviceProposalId", "createdAt");

-- CreateIndex
CREATE INDEX "service_proposal_versions_serviceProposalId_idx" ON "service_proposal_versions"("serviceProposalId");

-- CreateIndex
CREATE UNIQUE INDEX "service_proposal_versions_serviceProposalId_versionLabel_key" ON "service_proposal_versions"("serviceProposalId", "versionLabel");

-- CreateIndex
CREATE INDEX "tax_rates_companyId_idx" ON "tax_rates"("companyId");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_serviceProposalId_fkey" FOREIGN KEY ("serviceProposalId") REFERENCES "service_proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_proposal_disciplines" ADD CONSTRAINT "service_proposal_disciplines_serviceProposalId_fkey" FOREIGN KEY ("serviceProposalId") REFERENCES "service_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_proposal_phases" ADD CONSTRAINT "service_proposal_phases_serviceProposalId_fkey" FOREIGN KEY ("serviceProposalId") REFERENCES "service_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_proposal_fee_components" ADD CONSTRAINT "service_proposal_fee_components_serviceProposalId_fkey" FOREIGN KEY ("serviceProposalId") REFERENCES "service_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_proposal_development_cost_items" ADD CONSTRAINT "service_proposal_development_cost_items_serviceProposalId_fkey" FOREIGN KEY ("serviceProposalId") REFERENCES "service_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_proposal_payment_milestones" ADD CONSTRAINT "service_proposal_payment_milestones_serviceProposalId_fkey" FOREIGN KEY ("serviceProposalId") REFERENCES "service_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_proposal_reimbursables" ADD CONSTRAINT "service_proposal_reimbursables_serviceProposalId_fkey" FOREIGN KEY ("serviceProposalId") REFERENCES "service_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_proposal_discounts" ADD CONSTRAINT "service_proposal_discounts_serviceProposalId_fkey" FOREIGN KEY ("serviceProposalId") REFERENCES "service_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_proposal_taxes" ADD CONSTRAINT "service_proposal_taxes_serviceProposalId_fkey" FOREIGN KEY ("serviceProposalId") REFERENCES "service_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_proposal_status_history" ADD CONSTRAINT "service_proposal_status_history_serviceProposalId_fkey" FOREIGN KEY ("serviceProposalId") REFERENCES "service_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_proposal_versions" ADD CONSTRAINT "service_proposal_versions_serviceProposalId_fkey" FOREIGN KEY ("serviceProposalId") REFERENCES "service_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

