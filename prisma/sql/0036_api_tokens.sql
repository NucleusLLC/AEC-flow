-- 0036_api_tokens.sql
--
-- Connected apps: API tokens a desktop add-in (M.E.P.flow first) signs in with
-- to call /api/v1/* — read the practice's projects and send a material take-off
-- in as a new draft cost estimate. One new table, no new types.
--
-- APPLY BEFORE MERGING the PR that adds it — Settings -> Integrations lists
-- "api_tokens" for every Admin / Director, and every /api/v1 call looks a token
-- up in it, so deploying the code first makes the Integrations tab fail.
--
-- Numbered 0036, after 0035_appointments.sql. It is independent of every
-- earlier file and may be applied in any order relative to branches in review.
--
-- Purely additive: nothing that already exists is changed or dropped, so it is
-- safe to run against a live database and before the code reaches production.
-- It is also safe to run twice — every statement is guarded (IF NOT EXISTS).
--
-- ONLY THE HASH IS STORED. "tokenHash" is the sha256 (hex) of the whole token;
-- the token itself is shown once, at creation, and never written anywhere.
-- "prefix" is its first 12 characters ("aecf_" + 7), for telling tokens apart
-- on screen — far too short to be used.
--
-- NO FOREIGN KEYS, following "time_entries" and "appointments": "createdById"
-- is a loose user id so removing a user never blocks, and "companyId" is
-- checked by the app. Unlike most tenant tables "companyId" is NOT NULL here —
-- a token that names no practice could authenticate as nobody, and must not
-- exist. The only table created here is "api_tokens"; no existing table is
-- referenced.
--
-- Generated with:
--   npx prisma migrate diff --from-schema <HEAD>.prisma --to-schema prisma/schema.prisma --script
-- and reviewed by hand. Rehearsed against a local Postgres (embedded-postgres)
-- pushed from HEAD's schema: applied twice (the second run is a no-op), and
-- `prisma migrate diff` from that database to the new schema is empty
-- afterwards. Apply with:
--   node scripts/apply-sql.mjs prisma/sql/0036_api_tokens.sql
--   node scripts/verify-data-api-lockdown.mjs

-- CreateTable
CREATE TABLE IF NOT EXISTS "api_tokens" (
    "companyId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "api_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- The lookup every /api/v1 request makes, and the guarantee that one token
-- can only ever name one practice.
CREATE UNIQUE INDEX IF NOT EXISTS "api_tokens_tokenHash_key" ON "api_tokens"("tokenHash");
-- The Settings list: one practice's tokens, newest first.
CREATE INDEX IF NOT EXISTS "api_tokens_companyId_createdAt_idx" ON "api_tokens"("companyId", "createdAt");


-- Keep the Data API locked out (see 0012). A token hash is a credential: with
-- the table readable over /rest/v1 anyone could list which practices have
-- connected apps and when they were last used. RLS on with NO policies denies
-- anon/authenticated everything and leaves `postgres` (Prisma) and the service
-- role untouched.
ALTER TABLE "api_tokens" ENABLE ROW LEVEL SECURITY;

-- And no grants either, belt and braces with 0012's default privileges. The
-- roles only exist on Supabase, so a plain Postgres (a local rehearsal) skips
-- this rather than failing the whole file.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "api_tokens" FROM anon, authenticated;
  END IF;
END $$;
