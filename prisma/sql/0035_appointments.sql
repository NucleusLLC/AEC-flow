-- 0035_appointments.sql
--
-- Scheduling: meetings, inspections, measuring and supervision visits and
-- other field work, booked for a Project or for a potential project (a
-- Service Proposal). One new table, two new enums.
--
-- APPLY BEFORE MERGING the PR that adds it — /scheduling, the project
-- Scheduling tab and the Service Proposal page all read "appointments", so
-- deploying the code first makes those pages fail.
--
-- Numbered 0035: 0032–0034 may be taken by branches still in review. It is
-- independent of all of them and may be applied in any order.
--
-- Purely additive: nothing that already exists is changed or dropped, so it is
-- safe to run against a live database and before the code reaches production.
-- It is also safe to run twice — every statement is guarded (IF NOT EXISTS, or
-- a catalogue check for the types, which Postgres has no IF NOT EXISTS for).
--
-- TIMES ARE WALL-CLOCK STORED AS UTC: "09:00" on the form is 09:00Z here, and
-- the app always formats it with timeZone "UTC" (see the model comment in
-- prisma/schema.prisma).
--
-- NO FOREIGN KEYS, following "time_entries": the project, proposal, client and
-- attendee names are snapshots, and a link to a project that is later removed
-- must not block anything or rewrite history. The only table created here is
-- "appointments" (@@map'd snake_case); no existing table is referenced.
--
-- Generated with:
--   npx prisma migrate diff --from-schema <HEAD>.prisma --to-schema prisma/schema.prisma --script
-- and reviewed by hand. Rehearsed against a local Postgres pushed from HEAD's
-- schema; `prisma migrate diff` from that database to the new schema is empty
-- afterwards. Apply with:
--   node scripts/apply-sql.mjs prisma/sql/0035_appointments.sql
--   node scripts/verify-data-api-lockdown.mjs

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AppointmentType') THEN
    CREATE TYPE "AppointmentType" AS ENUM ('MEETING', 'INSPECTION', 'MEASURING', 'SUPERVISION', 'SITE_VISIT', 'OTHER');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AppointmentStatus') THEN
    CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'POSTPONED');
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "appointments" (
    "companyId" TEXT,
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" "AppointmentType" NOT NULL DEFAULT 'MEETING',
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "title" TEXT NOT NULL,
    "location" TEXT,
    "notes" TEXT,
    "outcome" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "actualHours" DECIMAL(65,30),
    "projectId" TEXT,
    "projectName" TEXT,
    "serviceProposalId" TEXT,
    "proposalNumber" TEXT,
    "proposalTitle" TEXT,
    "clientId" TEXT,
    "clientName" TEXT,
    "attendeeIds" TEXT[],
    "attendeeNames" TEXT[],
    "externalAttendees" TEXT,
    "timeLoggedAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "completedByName" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "appointments_companyId_startsAt_idx" ON "appointments"("companyId", "startsAt");
CREATE INDEX IF NOT EXISTS "appointments_companyId_status_idx" ON "appointments"("companyId", "status");
CREATE INDEX IF NOT EXISTS "appointments_companyId_projectId_idx" ON "appointments"("companyId", "projectId");
CREATE INDEX IF NOT EXISTS "appointments_companyId_serviceProposalId_idx" ON "appointments"("companyId", "serviceProposalId");
-- One SCH-YYYY-NNN per practice. (Only enforced where companyId is set; every
-- in-app write carries one, stamped by the tenant extension in lib/db.ts.)
CREATE UNIQUE INDEX IF NOT EXISTS "appointments_companyId_number_key" ON "appointments"("companyId", "number");


-- Keep the Data API locked out (see 0012). An appointment says where a
-- practice's people will be, at whose property and on which job — one
-- practice's diary must never be readable over /rest/v1, by anyone. RLS on
-- with NO policies denies anon/authenticated everything and leaves `postgres`
-- (Prisma) and the service role untouched.
ALTER TABLE "appointments" ENABLE ROW LEVEL SECURITY;

-- And no grants either, belt and braces with 0012's default privileges. The
-- roles only exist on Supabase, so a plain Postgres (a local rehearsal) skips
-- this rather than failing the whole file.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "appointments" FROM anon, authenticated;
  END IF;
END $$;
