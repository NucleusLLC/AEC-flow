-- Project agenda: tasks and reminders that live on a project and can be
-- assigned to another member. Additive and nullable throughout, so the existing
-- practice-wide task list (/tasks, projectId IS NULL) is unaffected.
--
-- Applied with: npx prisma db execute --file prisma/sql/0007_project_agenda.sql --schema prisma/schema.prisma
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AgendaKind') THEN
    CREATE TYPE "AgendaKind" AS ENUM ('TASK', 'REMINDER');
  END IF;
END
$$;

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "projectId"   TEXT;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "assigneeId"  TEXT;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "kind" "AgendaKind" NOT NULL DEFAULT 'TASK';

CREATE INDEX IF NOT EXISTS "tasks_projectId_idx"  ON "tasks" ("projectId");
CREATE INDEX IF NOT EXISTS "tasks_assigneeId_idx" ON "tasks" ("assigneeId");

COMMIT;
