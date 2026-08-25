-- Outbound email log (email_logs).
--
-- PURELY ADDITIVE. One new enum type, one new table, three indexes on it. No
-- ALTER, no DROP, no type change, no foreign key: nothing that exists is touched,
-- so an un-migrated reader sees exactly what it saw before and a rollback is a
-- DROP of two brand-new objects. The database is production and shared — that
-- constraint is the reason EmailLog carries no relation fields in the Prisma
-- schema, even though senderId and companyId reference real rows.
--
-- WHY THE TABLE EXISTS. A programme was emailed to a client and to the owner and
-- arrived nowhere, and nothing in the system recorded either the attempt or its
-- failure. Every attempt now writes a row, INCLUDING the ones that never reach
-- the provider (invalid recipient, RESEND_API_KEY unset) — a log of successes
-- only would have recorded that incident as silence.
--
-- `status` is SENT only when the provider returned a message id, which lands in
-- providerMessageId. Everything else is FAILED with the provider's or the
-- validator's own text in `error`.
--
-- `cc` is TEXT[] (Prisma String[]): already validated and de-duplicated by
-- lib/email/recipients.ts before it gets here.
--
-- Generated with:
--   npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
-- Applied with:
--   node scripts/apply-sql.mjs prisma/sql/0010_email_log.sql

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('SENT', 'FAILED');

-- CreateTable
CREATE TABLE "email_logs" (
    "companyId" TEXT,
    "id" TEXT NOT NULL,
    "senderId" TEXT,
    "senderName" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "cc" TEXT[],
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "documentName" TEXT,
    "providerMessageId" TEXT,
    "status" "EmailStatus" NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_logs_companyId_relatedType_relatedId_idx" ON "email_logs"("companyId", "relatedType", "relatedId");

-- CreateIndex
CREATE INDEX "email_logs_companyId_createdAt_idx" ON "email_logs"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "email_logs_companyId_idx" ON "email_logs"("companyId");
