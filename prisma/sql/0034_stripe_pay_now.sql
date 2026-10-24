-- 0034_stripe_pay_now.sql
--
-- Finance: clients pay an invoice ONLINE by card, through Stripe Connect.
--
-- APPLY BEFORE MERGING the PR that adds it. Prisma selects every column it
-- knows, so deploying the code first makes every invoice page, the invoice
-- register and Settings fail.
--
-- Numbered 0034: 0032 is taken by PR #180 and 0033 by the AEC-flow
-- subscriptions branch. Independent of both; may be applied in any order.
--
-- Purely additive: five columns on "companies", one on "invoices", one on
-- "invoice_payments", three unique indexes and one new enum value. Nothing that
-- exists is changed or dropped, so it is safe to run against the live database
-- and safe to run twice (IF NOT EXISTS everywhere).
--
-- NO NEW TABLE, so no new RLS policy and no new REVOKE: row-level security and
-- the 0012 Data API lockdown are per table, and the three tables touched here
-- are already locked down. New columns inherit that.
--
-- WHAT EACH COLUMN IS
--   companies."stripeAccountId"        the practice's own Stripe account (acct_...),
--                                      a Standard account connected to the Nucleus
--                                      platform. Card money goes to it, not to Nucleus.
--   companies."stripeChargesEnabled"   last status Stripe reported for that account
--   companies."stripePayoutsEnabled"     (account.updated webhook / onboarding return).
--   companies."stripeDetailsSubmitted"
--   companies."stripeStatusAt"
--   invoices."payToken"                the unguessable /pay/<token> link (32 random
--                                      bytes, base64url). Created lazily.
--   invoice_payments."stripePaymentIntentId"
--                                      UNIQUE: a replayed webhook cannot record the
--                                      same card payment twice. NULL for manual ones
--                                      (Postgres UNIQUE allows any number of NULLs).
--
-- "InvoicePaymentMethod" GAINS 'STRIPE' ("Card (Stripe)" on screen). Only the
-- Stripe webhook writes it. ADD VALUE cannot be used in the same transaction that
-- adds it, and nothing here uses it, so this file is safe inside one transaction.
--
-- Apply with:
--   node scripts/apply-sql.mjs prisma/sql/0034_stripe_pay_now.sql
--   node scripts/verify-data-api-lockdown.mjs

-- AlterEnum
ALTER TYPE "InvoicePaymentMethod" ADD VALUE IF NOT EXISTS 'STRIPE';

-- AlterTable: companies
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "stripeAccountId" TEXT;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "stripeChargesEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "stripePayoutsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "stripeDetailsSubmitted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "stripeStatusAt" TIMESTAMP(3);

-- AlterTable: invoices
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "payToken" TEXT;

-- AlterTable: invoice_payments
ALTER TABLE "invoice_payments" ADD COLUMN IF NOT EXISTS "stripePaymentIntentId" TEXT;

-- CreateIndex (names are Prisma's, so `prisma migrate diff` stays quiet)
CREATE UNIQUE INDEX IF NOT EXISTS "companies_stripeAccountId_key" ON "companies"("stripeAccountId");
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_payToken_key" ON "invoices"("payToken");
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_payments_stripePaymentIntentId_key" ON "invoice_payments"("stripePaymentIntentId");
