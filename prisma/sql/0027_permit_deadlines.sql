-- 0027 — DEADLINES on a building permit file.
--
-- A permit can carry several dated deadlines: "deadline to submit review",
-- "deadline to reply / respond", or one typed by hand (OTHER + label). The
-- dashboards show every unmet one: yellow while it is more than 14 days away,
-- red inside 14 days, blinking red inside 3 days and once it has passed
-- (lib/building-permits/deadlines.ts). Marking one met sets "metAt" and takes it
-- off the boards; the row stays as the record.
--
-- Additive: one new enum and one new table. Nothing existing is altered.
-- APPLY BEFORE MERGING the PR that adds it — the permit case file and both
-- dashboards read this table, so deploying the code first makes them fail.
--
-- Numbered 0027: 0025 belongs to the credit-notes branch and 0026 is the project
-- archive. Independent of both; may be applied in any order.
--
-- RLS: the 0012 lockdown is per table, so the new table needs its own enable
-- (no policies — only the app's server connection reads it). Idempotent: safe to
-- run twice.
--
-- Apply with:
--   node scripts/apply-sql.mjs prisma/sql/0027_permit_deadlines.sql
--   node scripts/verify-data-api-lockdown.mjs

do $$
begin
  if not exists (select 1 from pg_type where typname = 'PermitDeadlineKind') then
    create type "PermitDeadlineKind" as enum ('SUBMIT_REVIEW', 'REPLY', 'OTHER');
  end if;
end
$$;

create table if not exists "building_permit_deadlines" (
  "companyId"     text,
  "id"            text not null,
  "permitId"      text not null,
  "kind"          "PermitDeadlineKind" not null,
  "label"         text,
  "dueDate"       date not null,
  "metAt"         timestamp(3),
  "createdById"   text,
  "createdByName" text,
  "createdAt"     timestamp(3) not null default current_timestamp,
  "updatedAt"     timestamp(3) not null,

  constraint "building_permit_deadlines_pkey" primary key ("id"),
  -- OTHER must say what it is; a label is at most 120 characters.
  constraint "building_permit_deadlines_label_check" check (
    ("kind" <> 'OTHER' or length(btrim(coalesce("label", ''))) > 0)
    and ("label" is null or length("label") <= 120)
  )
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'building_permit_deadlines_permitId_fkey'
  ) then
    alter table "building_permit_deadlines"
      add constraint "building_permit_deadlines_permitId_fkey"
      foreign key ("permitId") references "building_permits"("id")
      on delete cascade on update cascade;
  end if;
end
$$;

-- The dashboards ask "every open deadline, soonest first" on every load.
create index if not exists "building_permit_deadlines_companyId_dueDate_idx"
  on "building_permit_deadlines" ("companyId", "dueDate");
create index if not exists "building_permit_deadlines_permitId_idx"
  on "building_permit_deadlines" ("permitId");

alter table "building_permit_deadlines" enable row level security;

-- Belt and braces for the Data API roles (0012 already revokes by default
-- privileges). Guarded so the file also runs where those roles do not exist.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon')
     and exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table "building_permit_deadlines" from anon, authenticated;
  end if;
end
$$;
