-- 0016_invoices.sql
--
-- Finance: invoices and the payments received against them. Three new tables
-- and two new enums.
--
-- Purely additive: it touches nothing that already exists, so it is safe to run
-- against a live database.
--
-- Numbered 0016 because 0015 is the General Documents table. The two are
-- independent and can be applied in either order.
--
-- EVERYTHING ON AN INVOICE IS A SNAPSHOT — the client's name, the tax name and
-- percentage, the line descriptions and every amount are copied on when the
-- invoice is raised. A proposal that is later revised, a tax rate that changes
-- next year and a client that is renamed must not rewrite a document that has
-- already been sent. Money columns are DECIMAL, never float.
--
-- Generated with:
--   npx prisma migrate diff --from-schema <main>.prisma --to-schema prisma/schema.prisma --script
-- and reviewed by hand. Apply with:
--   node scripts/apply-sql.mjs prisma/sql/0016_invoices.sql
--   node scripts/verify-data-api-lockdown.mjs

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PART_PAID', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "InvoicePaymentMethod" AS ENUM ('BANK_TRANSFER', 'CASH', 'CHEQUE', 'CARD', 'OTHER');

-- CreateTable
CREATE TABLE "invoices" (
    "companyId" TEXT,
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'AWG',
    "clientId" TEXT,
    "clientName" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "billingAddress" TEXT,
    "projectId" TEXT,
    "projectName" TEXT,
    "serviceProposalId" TEXT,
    "proposalNumber" TEXT,
    "title" TEXT,
    "intro" TEXT,
    "issueDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "termsDays" INTEGER,
    "taxName" TEXT,
    "taxPercent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxMode" "TaxMode" NOT NULL DEFAULT 'EXCLUSIVE',
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxableSubtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "footer" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "updatedById" TEXT,
    "issuedByName" TEXT,
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "companyId" TEXT,
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "milestoneId" TEXT,
    "milestoneName" TEXT,
    "quantity" DECIMAL(65,30),
    "unitRate" DECIMAL(65,30),
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_payments" (
    "companyId" TEXT,
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "method" "InvoicePaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "reference" TEXT,
    "notes" TEXT,
    "recordedById" TEXT,
    "recordedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoices_companyId_status_idx" ON "invoices"("companyId", "status");

-- CreateIndex
CREATE INDEX "invoices_companyId_clientId_idx" ON "invoices"("companyId", "clientId");

-- CreateIndex
CREATE INDEX "invoices_companyId_projectId_idx" ON "invoices"("companyId", "projectId");

-- CreateIndex
CREATE INDEX "invoices_companyId_issueDate_idx" ON "invoices"("companyId", "issueDate");

-- CreateIndex
CREATE INDEX "invoices_companyId_serviceProposalId_idx" ON "invoices"("companyId", "serviceProposalId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_companyId_number_key" ON "invoices"("companyId", "number");

-- CreateIndex
CREATE INDEX "invoice_lines_companyId_invoiceId_idx" ON "invoice_lines"("companyId", "invoiceId");

-- CreateIndex
CREATE INDEX "invoice_lines_companyId_milestoneId_idx" ON "invoice_lines"("companyId", "milestoneId");

-- CreateIndex
CREATE INDEX "invoice_payments_companyId_invoiceId_idx" ON "invoice_payments"("companyId", "invoiceId");

-- CreateIndex
CREATE INDEX "invoice_payments_companyId_paidAt_idx" ON "invoice_payments"("companyId", "paidAt");

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Keep the Data API locked out (see 0012). Receivables are the most obviously
-- company-private tables in the app: one practice's billing must never be
-- readable over /rest/v1, by anyone.
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_payments" ENABLE ROW LEVEL SECURITY;
