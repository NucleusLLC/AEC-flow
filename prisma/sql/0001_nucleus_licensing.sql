-- 0001_nucleus_licensing.sql
-- Nucleus licensing: beta_codes pool + per-company licence state.
-- Purely additive (nullable columns + a new table); verified with `prisma migrate diff`.
-- Applied to zouzxwuojnsyjvadvldr 2026-07-19.
-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "licenseCheckedAt" TIMESTAMP(3),
ADD COLUMN     "licenseEntitlements" JSONB,
ADD COLUMN     "licenseKey" TEXT,
ADD COLUMN     "licenseKeyPrefix" TEXT,
ADD COLUMN     "licenseStatus" TEXT,
ADD COLUMN     "licenseValidUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "beta_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "cohort" TEXT,
    "claimedByUserId" TEXT,
    "claimedEmail" TEXT,
    "claimedAt" TIMESTAMP(3),
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beta_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "beta_codes_code_key" ON "beta_codes"("code");

-- CreateIndex
CREATE INDEX "beta_codes_status_idx" ON "beta_codes"("status");

-- CreateIndex
CREATE INDEX "beta_codes_claimedEmail_idx" ON "beta_codes"("claimedEmail");

