-- 0024 — a revision deadline on a building permit, and the dashboard reminder
-- that starts blinking a set number of days before it (a week by default).
--
-- Additive: four columns on "building_permits", three nullable and one with a
-- default, so existing rows are untouched and read back as "no revision due".
-- Apply BEFORE merging the PR that adds them — Prisma selects every column it
-- knows, so deploying the code first makes every permit page fail.
--
-- RLS and the 0012 lockdown are per table, so new columns need no grants.
--
-- Apply with:
--   node scripts/apply-sql.mjs prisma/sql/0024_permit_revision_reminder.sql
--   node scripts/verify-data-api-lockdown.mjs

alter table "building_permits" add column if not exists "revisionDueAt" timestamp(3);
alter table "building_permits" add column if not exists "revisionReminderDays" integer not null default 7;
alter table "building_permits" add column if not exists "revisionNote" text;
alter table "building_permits" add column if not exists "revisionSetAt" timestamp(3);

-- The dashboard asks "which open files have a revision due?" on every load.
create index if not exists "building_permits_companyId_revisionDueAt_idx"
  on "building_permits" ("companyId", "revisionDueAt");
