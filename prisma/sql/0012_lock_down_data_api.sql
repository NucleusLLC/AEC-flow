-- Lock the Supabase Data API (PostgREST) out of the public schema.
--
-- WHY. Probed on production 2026-09-14: all 80 public tables had RLS disabled
-- and the `anon` and `authenticated` roles held SELECT, INSERT, UPDATE, DELETE
-- and TRUNCATE on every one of them — including "User" (password hashes),
-- "Session" and invitations. Anyone holding the project's anon key could read
-- or rewrite the whole database over /rest/v1. Default privileges granted the
-- same to every table created later, so each new prisma/sql file re-opened it.
--
-- WHY IT IS SAFE FOR THE APP. AEC-flow never uses the Data API: there is no
-- anon key in the environment and no supabase-js. It reaches Postgres only as
-- `postgres` through Prisma (table owner, BYPASSRLS) and Storage only with the
-- service-role key (BYPASSRLS). Neither is touched here. RLS is enabled with no
-- policies, which denies everything to anon/authenticated and nothing to the
-- two roles the app actually uses.
--
-- Verify afterwards: node scripts/verify-data-api-lockdown.mjs

-- 1. Row level security on, every public table. No policies = deny by default.
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;
END $$;

-- 2. Remove the existing grants.
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
-- Functions default to EXECUTE for PUBLIC, which anon inherits; revoking from
-- anon alone leaves that path open, so PUBLIC is revoked too. Grants held by
-- supabase_auth_admin (custom_access_token_hook) are left as they are.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- 3. Stop future objects from being granted to them. Every table in this
-- schema is created by `postgres`, so its defaults are the ones that matter.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- supabase_admin carries the same defaults, but `postgres` may not be allowed
-- to alter another role's defaults. Try it without failing the whole file.
DO $$
BEGIN
  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'supabase_admin default privileges left unchanged (insufficient privilege)';
END $$;
