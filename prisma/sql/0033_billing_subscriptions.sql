-- 0033_billing_subscriptions.sql
--
-- AEC-flow subscription billing (decision D-5: Stripe Billing on the Nucleus
-- LLC Stripe account). Seven new columns on "companies" and one new table,
-- "billing_webhook_events".
--
-- APPLY BEFORE MERGING the PR that adds it. Prisma selects every column of a
-- model it reads in full, so once the code is deployed a "companies" read
-- without these columns fails — that would break sign-in and every page.
--
-- Numbered 0033: 0032 is taken by PR #180 and 0034 by the invoice Pay-now
-- (Stripe Connect) PR. Independent of both; may be applied in any order.
--
-- Purely additive: nothing that exists is changed or dropped, every new column
-- is nullable or has a default, so it is safe against a live database and safe
-- before the code that uses it reaches production. Safe to run twice — every
-- statement is guarded (IF NOT EXISTS).
--
-- NOTHING IS ENFORCED. These columns only record what Stripe reports; no
-- practice is locked out by them (lib/billing/status.ts, BILLING_ENFORCED).
-- Every existing practice starts with NULL status = "none" (never subscribed).
--
-- "billing_webhook_events" is the idempotency record of the Stripe webhook
-- (/api/billing/webhook): one row per Stripe event id already applied. It is
-- a PLATFORM table — which Stripe event touched which practice — not practice
-- content, so it is not tenant-scoped; its company column is "billingCompanyId".
--
-- Apply with:
--   node scripts/apply-sql.mjs prisma/sql/0033_billing_subscriptions.sql
--   node scripts/verify-data-api-lockdown.mjs

-- AlterTable
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "subscriptionPriceId" TEXT;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "subscriptionCurrentPeriodEnd" TIMESTAMP(3);
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "subscriptionCancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "subscriptionEventAt" TIMESTAMP(3);

-- CreateIndex: one practice per Stripe customer (the webhook finds the practice by it).
CREATE UNIQUE INDEX IF NOT EXISTS "companies_stripeCustomerId_key" ON "companies"("stripeCustomerId");

-- CreateTable
CREATE TABLE IF NOT EXISTS "billing_webhook_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "billingCompanyId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "billing_webhook_events_billingCompanyId_idx" ON "billing_webhook_events"("billingCompanyId");


-- Keep the Data API locked out (see 0012). Which practice pays, and which
-- Stripe events reached it, must never be readable over /rest/v1. RLS on with
-- NO policies denies anon/authenticated everything and leaves `postgres`
-- (Prisma) and the service role untouched. "companies" already has RLS on
-- from 0012; the new table needs its own.
ALTER TABLE "billing_webhook_events" ENABLE ROW LEVEL SECURITY;

-- And no grants either, belt and braces with 0012's default privileges. The
-- roles only exist on Supabase, so a plain Postgres (a local rehearsal) skips
-- this rather than failing the whole file.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "billing_webhook_events" FROM anon, authenticated;
  END IF;
END $$;
