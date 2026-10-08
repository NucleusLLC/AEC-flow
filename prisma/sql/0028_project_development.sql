-- 0028 — DEVELOPMENT on a project.
--
-- The project form's Disciplines row gains a DEVELOPMENT tick box. Ticked, the
-- project says what kind of development it is: HOUSING, CONDO / APARTMENT,
-- TOWN HOMES, RESORT, PARCELING, or OTHER with the type typed in by hand
-- (lib/projects/development.ts). It shows as a "Development · …" tag on the
-- Projects list, the project overview and the printed project sheet.
--
-- Additive: one new enum and two nullable columns on "Project", so every
-- existing project reads back as "not a development". The shared "Discipline"
-- enum is NOT touched (phases, team members, proposals and schedules use it).
--
-- APPLY BEFORE MERGING — Prisma selects every column it knows, so deploying
-- first makes every project page fail.
--
-- Numbered 0028: 0025 is the credit-notes branch, 0026 the project archive and
-- 0027 the permit deadlines. Independent of all three; any order.
--
-- RLS and the 0012 lockdown are per table, so new columns need no grants.
-- Idempotent: safe to run twice.
--
-- Apply with:
--   node scripts/apply-sql.mjs prisma/sql/0028_project_development.sql
--   node scripts/verify-data-api-lockdown.mjs

do $$
begin
  if not exists (select 1 from pg_type where typname = 'ProjectDevelopmentType') then
    create type "ProjectDevelopmentType" as enum
      ('HOUSING', 'CONDO_APARTMENT', 'TOWN_HOMES', 'RESORT', 'PARCELING', 'OTHER');
  end if;
end
$$;

alter table "Project" add column if not exists "developmentType" "ProjectDevelopmentType";
alter table "Project" add column if not exists "developmentTypeOther" text;

-- The typed type is a short label: 80 characters at most (the form enforces the
-- same limit). Guarded so a second run does not fail.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'Project_developmentTypeOther_length_check'
  ) then
    alter table "Project"
      add constraint "Project_developmentTypeOther_length_check"
      check ("developmentTypeOther" is null or length("developmentTypeOther") <= 80);
  end if;
end
$$;
