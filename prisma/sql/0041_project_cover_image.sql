-- 0041_project_cover_image.sql — project cover image (Import from MEPflow, 0.48.0).
--
-- The Project model has NO @@map, so the table is "Project" (not "projects").
--
-- One nullable column: the storage key of the project's cover image in the
-- private drawings bucket. NULL = no cover (every existing project).
-- Apply BEFORE the 0.48.0 code reaches main: Prisma reads every Project column,
-- so without it every project page answers 500.

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "coverImageKey" TEXT;
