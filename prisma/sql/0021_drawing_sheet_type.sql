-- 0021_drawing_sheet_type.sql
--
-- Drawing Studio DS-0: what the system read off an uploaded sheet — the plot
-- paper size, how many pages the PDF has, and what kind of drawing it is.
--
-- One new enum and eight NULLable columns on an existing table. Purely
-- additive: every existing row keeps working with all eight null, which is the
-- honest state for a sheet uploaded before anything could read it.
--
-- NULL IS A REAL ANSWER HERE and the screens treat it as one. A CAD file has no
-- media box to read, a scanned sheet has no text to classify, and a register
-- that prints a confident "A1" for a file nobody could open is worse than one
-- that prints nothing.
--
-- Numbered 0021 because 0020 is Finance time and expenses. The two are
-- independent and can be applied in either order.
--
-- Apply with:
--   node scripts/apply-sql.mjs prisma/sql/0021_drawing_sheet_type.sql
--   node scripts/verify-data-api-lockdown.mjs

-- CreateEnum
CREATE TYPE "DrawingSheetType" AS ENUM (
  'COVER',
  'GENERAL_NOTES',
  'SITE_PLAN',
  'DEMOLITION',
  'FLOOR_PLAN',
  'ROOF_PLAN',
  'REFLECTED_CEILING_PLAN',
  'FOUNDATION_PLAN',
  'ELEVATION',
  'SECTION',
  'DETAIL',
  'SCHEDULE',
  'DIAGRAM',
  'THREE_D',
  'SURVEY',
  'LANDSCAPE',
  'OTHER'
);

-- AlterTable
ALTER TABLE "drawings" ADD COLUMN IF NOT EXISTS "sheetType" "DrawingSheetType";
ALTER TABLE "drawings" ADD COLUMN IF NOT EXISTS "sheetTypeSource" TEXT;
ALTER TABLE "drawings" ADD COLUMN IF NOT EXISTS "paperSize" TEXT;
ALTER TABLE "drawings" ADD COLUMN IF NOT EXISTS "paperSeries" TEXT;
ALTER TABLE "drawings" ADD COLUMN IF NOT EXISTS "paperOrientation" TEXT;
ALTER TABLE "drawings" ADD COLUMN IF NOT EXISTS "paperWidthMm" DECIMAL(65,30);
ALTER TABLE "drawings" ADD COLUMN IF NOT EXISTS "paperHeightMm" DECIMAL(65,30);
ALTER TABLE "drawings" ADD COLUMN IF NOT EXISTS "pageCount" INTEGER;

-- CreateIndex: the register filters by type inside a project, which is the
-- query a "show me every floor plan on this job" filter makes.
CREATE INDEX IF NOT EXISTS "drawings_companyId_sheetType_idx" ON "drawings"("companyId", "sheetType");

-- `drawings` already has RLS enabled (0009 + 0012). Stated here so an audit of
-- this file does not have to go looking, and so the habit holds: every
-- migration in this repo ends by confirming the Data API cannot read the table.
ALTER TABLE "drawings" ENABLE ROW LEVEL SECURITY;
