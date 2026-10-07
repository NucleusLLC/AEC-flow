-- 0026 — archive a project.
--
-- Additive: two nullable columns on "Project", so every existing project reads
-- back as "not archived". Apply BEFORE merging the PR that adds them — Prisma
-- selects every column it knows, so deploying the code first makes every
-- project page fail.
--
-- Numbered 0026 because 0025 is taken by the credit-notes branch; the two are
-- independent and may be applied in either order.
--
-- RLS and the 0012 lockdown are per table, so new columns need no grants.
--
-- Apply with:
--   node scripts/apply-sql.mjs prisma/sql/0026_project_archive.sql
--   node scripts/verify-data-api-lockdown.mjs

alter table "Project" add column if not exists "archivedAt" timestamp(3);
alter table "Project" add column if not exists "archivedById" text;
