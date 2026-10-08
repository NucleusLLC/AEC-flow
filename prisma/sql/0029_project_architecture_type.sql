-- 0029 — ARCHITECTURE TYPE on a project.
--
-- When the ARCHITECTURE discipline is ticked on the project form, the project
-- says what kind of architecture project it is: SINGLE FAMILY HOME, MANSION,
-- COMMERCIAL BUILDING, RETAIL BUILDING, APARTMENT / CONDO BUILDING, APARTMENT,
-- SCHOOL, RESORT, or OTHER with the type typed in by hand
-- (lib/projects/architecture-type.ts). The "Architecture" discipline tag then
-- reads "Architecture · …" on the Projects list, the project overview and the
-- printed project sheet.
--
-- Additive: one new enum and two nullable columns on "Project", so every
-- existing project reads back with no architecture type (its tag stays plain
-- "Architecture"). The shared "Discipline" enum is NOT touched.
--
-- APPLY BEFORE MERGING — Prisma selects every column it knows, so deploying
-- first makes every project page fail.
--
-- Numbered 0029: 0028 is the project DEVELOPMENT type. Independent of it; any
-- order.
--
-- RLS and the 0012 lockdown are per table, so new columns need no grants.
-- Idempotent: safe to run twice.
--
-- Apply with:
--   node scripts/apply-sql.mjs prisma/sql/0029_project_architecture_type.sql
--   node scripts/verify-data-api-lockdown.mjs

do $$
begin
  if not exists (select 1 from pg_type where typname = 'ProjectArchitectureType') then
    create type "ProjectArchitectureType" as enum
      ('SINGLE_FAMILY_HOME', 'MANSION', 'COMMERCIAL_BUILDING', 'RETAIL_BUILDING',
       'APARTMENT_CONDO_BUILDING', 'APARTMENT', 'SCHOOL', 'RESORT', 'OTHER');
  end if;
end
$$;

alter table "Project" add column if not exists "architectureType" "ProjectArchitectureType";
alter table "Project" add column if not exists "architectureTypeOther" text;

-- The typed type is a short label: 80 characters at most (the form enforces the
-- same limit). Guarded so a second run does not fail.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'Project_architectureTypeOther_length_check'
  ) then
    alter table "Project"
      add constraint "Project_architectureTypeOther_length_check"
      check ("architectureTypeOther" is null or length("architectureTypeOther") <= 80);
  end if;
end
$$;
