-- 0039_proposal_acceptance.sql
--
-- Service Proposal client acceptance by secure link (Release C, 0.45.0). The
-- practice creates a link on an issued proposal; the client opens
-- /p/<token> with no account, reads the proposal and accepts it (name,
-- position, typed-name signature) or declines it (optional reason). One new
-- table, no new types: each row is one link and, once answered, the record of
-- that answer.
--
-- APPLY BEFORE MERGING the PR that adds it — the Service Proposal detail page
-- reads "service_proposal_acceptance_links" for every proposal it opens, so
-- deploying the code first makes that page fail.
--
-- Numbered 0039, after 0038_drawing_ai_intake.sql. It is independent of every
-- earlier file and may be applied in any order relative to branches in review.
--
-- Purely additive: nothing that already exists is changed or dropped, so it is
-- safe to run against a live database and before the code reaches production.
-- It is also safe to run twice — every statement is guarded (IF NOT EXISTS).
--
-- ONLY THE HASH IS STORED. "tokenHash" is the sha256 (hex) of the whole token
-- (32 random bytes, base64url); the token itself is shown to the practice
-- once, at creation, and never written anywhere.
--
-- NO FOREIGN KEYS, following "api_tokens" and "appointments":
-- "serviceProposalId" and "createdById" are loose ids (proposals are only ever
-- soft-deleted), and "companyId" is checked by the app. Like "api_tokens",
-- "companyId" is NOT NULL — a link that names no practice could act for
-- nobody, and must not exist. "decision" is TEXT ('ACCEPTED' / 'DECLINED',
-- NULL while the link is open), checked by the app, so no new enum type.
--
-- Generated with:
--   npx prisma migrate diff --from-schema <HEAD>.prisma --to-schema prisma/schema.prisma --script
-- and reviewed by hand (IF NOT EXISTS added; nothing else changed). Apply with:
--   node scripts/apply-sql.mjs prisma/sql/0039_proposal_acceptance.sql
--   node scripts/verify-data-api-lockdown.mjs

-- CreateTable
CREATE TABLE IF NOT EXISTS "service_proposal_acceptance_links" (
    "companyId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "serviceProposalId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "versionLabel" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decision" TEXT,
    "decidedAt" TIMESTAMP(3),
    "signerName" TEXT,
    "signerTitle" TEXT,
    "signerCompany" TEXT,
    "signature" TEXT,
    "declineReason" TEXT,
    "decisionIp" TEXT,
    "decisionUserAgent" TEXT,

    CONSTRAINT "service_proposal_acceptance_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- The lookup every /p/<token> request makes, and the guarantee that one token
-- can only ever name one link.
CREATE UNIQUE INDEX IF NOT EXISTS "service_proposal_acceptance_links_tokenHash_key" ON "service_proposal_acceptance_links"("tokenHash");

-- CreateIndex
-- The proposal detail page: one proposal's links, newest first.
CREATE INDEX IF NOT EXISTS "service_proposal_acceptance_links_serviceProposalId_created_idx" ON "service_proposal_acceptance_links"("serviceProposalId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "service_proposal_acceptance_links_companyId_createdAt_idx" ON "service_proposal_acceptance_links"("companyId", "createdAt");


-- Keep the Data API locked out (see 0012). A token hash is a credential, and an
-- answered row holds the client's name, signature, IP address and browser:
-- with the table readable over /rest/v1 anyone could read who accepted which
-- practice's proposals. RLS on with NO policies denies anon/authenticated
-- everything and leaves `postgres` (Prisma) and the service role untouched.
ALTER TABLE "service_proposal_acceptance_links" ENABLE ROW LEVEL SECURITY;

-- And no grants either, belt and braces with 0012's default privileges. The
-- roles only exist on Supabase, so a plain Postgres (a local rehearsal) skips
-- this rather than failing the whole file.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "service_proposal_acceptance_links" FROM anon, authenticated;
  END IF;
END $$;
