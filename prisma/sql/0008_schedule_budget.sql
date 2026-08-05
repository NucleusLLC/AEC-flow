-- Schedule Budget (BUDGET vs COMMITTED vs RECEIVED).
--
-- PROTECTED SYSTEM (schedule) — additive schema change, approved 2026-08-04.
--
-- Two additions, both nullable, no drops, no type changes, so this cannot fail on
-- an existing row and an un-migrated reader sees exactly what it saw before:
--
--   1. schedule_tasks gains a per-task budget (Decimal — money is never a float)
--      plus its provenance, so the panel can distinguish a figure a human typed
--      from one taken off the Cost Estimate.
--   2. purchase_orders gains scheduleTaskKey — the only way a commitment can be
--      attributed to an ACTIVITY rather than merely to a project. It is a loose
--      string, NOT a foreign key: `saveSchedule` deletes and recreates every
--      schedule_tasks row on each save, so an FK to schedule_tasks.id would be
--      cascade-deleted (or would block the save) every time the programme is
--      edited. taskKey survives that rewrite; the row's own projectId scopes it.
--
-- DECIMAL(65,30) is what Prisma's `Decimal` maps to in PostgreSQL, and matches the
-- money columns already on purchase_orders (subtotal / total).
--
-- Applied with: npx prisma db execute --file prisma/sql/0008_schedule_budget.sql
-- (Prisma 7 dropped `--schema` from `db execute`; the datasource now comes from
--  prisma.config.ts, which points at DIRECT_URL. Earlier files in this folder
--  still document the Prisma 6 form.)
BEGIN;

ALTER TABLE "schedule_tasks" ADD COLUMN IF NOT EXISTS "budgetAmount" DECIMAL(65,30);
ALTER TABLE "schedule_tasks" ADD COLUMN IF NOT EXISTS "budgetSource" TEXT;
ALTER TABLE "schedule_tasks" ADD COLUMN IF NOT EXISTS "budgetRef"    TEXT;

ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "scheduleTaskKey" TEXT;

-- The rollup's only new query shape: "every commitment on this project, grouped by
-- activity". Composite because scheduleTaskKey alone is not unique across projects.
CREATE INDEX IF NOT EXISTS "purchase_orders_projectId_scheduleTaskKey_idx"
  ON "purchase_orders" ("projectId", "scheduleTaskKey");

COMMIT;
