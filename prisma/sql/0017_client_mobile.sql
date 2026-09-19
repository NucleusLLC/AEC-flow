-- 0017 — a cell phone on the client record.
--
-- Additive and nullable: existing rows are untouched, and nothing reads the
-- column until the code that knows about it is deployed. Apply BEFORE merging
-- the PR that adds `Client.mobile` — Prisma selects every column it knows, so
-- deploying the code first makes every client page fail.
--
-- RLS and the 0012 lockdown are per table, so a new column needs no grants.

alter table "Client" add column if not exists "mobile" text;
