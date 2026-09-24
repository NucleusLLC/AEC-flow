-- 0020_time_expenses.sql
--
-- Finance F3: the hours the practice works and the money it lays out. Two new
-- tables, two new enums, two new columns on "User".
--
-- Purely additive: the only change to an existing table is two NULLable rate
-- columns on "User", so it is safe to run against a live database and safe to
-- run before the code that uses it reaches production.
--
-- NO FOREIGN KEY TO "invoices". When hours or an expense are billed, the
-- invoice's id and number are written onto the row instead. Voiding or deleting
-- an invoice must never take the timesheet with it — the work happened either
-- way, and a cascade is how a month of hours disappears behind one mis-click.
--
-- Money columns are DECIMAL, never float. Hours are DECIMAL too: a quarter hour
-- is 0.25 exactly, and a float sum of 0.1-hour entries is not.
--
-- Generated with:
--   npx prisma migrate diff --from-schema <main>.prisma --to-schema prisma/schema.prisma --script
-- and reviewed by hand. Apply with:
--   node scripts/apply-sql.mjs prisma/sql/0020_time_expenses.sql
--   node scripts/verify-data-api-lockdown.mjs

-- CreateEnum
CREATE TYPE "FinanceApprovalStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('TRAVEL', 'ACCOMMODATION', 'MEALS', 'PRINTING', 'PERMIT_FEE', 'SUBCONSULTANT', 'SOFTWARE', 'EQUIPMENT', 'MATERIALS', 'OTHER');

-- AlterTable: the person's standard hourly rates. NULL means "no rate on file",
-- which is not the same as zero — an entry saved against a rateless person is
-- worth nothing until somebody sets one, and the screens say so rather than
-- printing a confident 0.00.
-- NOTE THE QUOTED "User". Most tables in this schema carry an @@map to a
-- snake_case name; the User model does not, so its table is PascalCase and
-- unquoted `users` does not exist. Caught by rehearsing this file against a
-- throwaway copy of production's schema before it was run for real.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "chargeOutRate" DECIMAL(65,30);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "costRate" DECIMAL(65,30);

-- CreateTable
CREATE TABLE "time_entries" (
    "companyId" TEXT,
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "projectId" TEXT,
    "projectName" TEXT,
    "phaseId" TEXT,
    "phaseName" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "hours" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "chargeRate" DECIMAL(65,30),
    "costRate" DECIMAL(65,30),
    "currency" TEXT NOT NULL DEFAULT 'AWG',
    "description" TEXT,
    "status" "FinanceApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "rejectedReason" TEXT,
    "invoicedAt" TIMESTAMP(3),
    "invoiceId" TEXT,
    "invoiceNumber" TEXT,
    "invoiceLineId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "companyId" TEXT,
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "projectId" TEXT,
    "projectName" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "category" "ExpenseCategory" NOT NULL DEFAULT 'OTHER',
    "vendor" TEXT,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'AWG',
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "markupPercent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "reimbursable" BOOLEAN NOT NULL DEFAULT false,
    "reimbursedAt" TIMESTAMP(3),
    "status" "FinanceApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "rejectedReason" TEXT,
    "invoicedAt" TIMESTAMP(3),
    "invoiceId" TEXT,
    "invoiceNumber" TEXT,
    "invoiceLineId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "time_entries_companyId_userId_date_idx" ON "time_entries"("companyId", "userId", "date");

-- CreateIndex
CREATE INDEX "time_entries_companyId_projectId_date_idx" ON "time_entries"("companyId", "projectId", "date");

-- CreateIndex
CREATE INDEX "time_entries_companyId_status_idx" ON "time_entries"("companyId", "status");

-- CreateIndex
CREATE INDEX "time_entries_companyId_invoicedAt_idx" ON "time_entries"("companyId", "invoicedAt");

-- CreateIndex
CREATE INDEX "expenses_companyId_userId_date_idx" ON "expenses"("companyId", "userId", "date");

-- CreateIndex
CREATE INDEX "expenses_companyId_projectId_date_idx" ON "expenses"("companyId", "projectId", "date");

-- CreateIndex
CREATE INDEX "expenses_companyId_status_idx" ON "expenses"("companyId", "status");

-- CreateIndex
CREATE INDEX "expenses_companyId_invoicedAt_idx" ON "expenses"("companyId", "invoicedAt");


-- Keep the Data API locked out (see 0012). A timesheet is the most personal
-- table in the app — who worked, on what, for how long — and what an hour costs
-- the practice is not a figure any client may read. Neither is reachable over
-- /rest/v1, by anyone.
ALTER TABLE "time_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;
