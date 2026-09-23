-- 0022_drawing_studio.sql
--
-- Drawing Studio DS-2 and DS-3: redline markup, and review comments pinned to a
-- point on a sheet. Two new tables, two new enums. Nothing existing changes.
--
-- THE SOURCE PDF IS NEVER TOUCHED. Every mark is a row pointing at a drawing.
-- Flattening for issue (DS-4) writes a NEW storage object and leaves the
-- original alone, because a practice has to be able to produce the file it was
-- sent, unaltered, months after an argument starts.
--
-- GEOMETRY IS IN PDF USER SPACE — points, origin bottom-left, per page — never
-- screen pixels. A redline made at one zoom on one monitor has to land on the
-- same door on every other. The shape lives in a JSONB column discriminated by
-- `kind` and validated before the write by `isValidGeometry`
-- (lib/drawings/markup.ts); the database stores what the app has already
-- checked rather than a free-form blob nobody validates.
--
-- CASCADE IS CORRECT HERE, unlike on the finance tables. A markup has no
-- meaning without the sheet it sits on, and drawing rows are superseded rather
-- than deleted, so the cascade fires only when a drawing is genuinely removed.
--
-- Apply with:
--   node scripts/apply-sql.mjs prisma/sql/0022_drawing_studio.sql
--   node scripts/verify-data-api-lockdown.mjs

-- CreateEnum
CREATE TYPE "DrawingMarkupKind" AS ENUM (
  'PEN', 'LINE', 'ARROW', 'RECT', 'ELLIPSE', 'CLOUD',
  'TEXT', 'CALLOUT', 'HIGHLIGHT', 'MEASURE', 'STAMP'
);

-- CreateEnum
CREATE TYPE "DrawingCommentStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "drawing_markups" (
    "companyId" TEXT,
    "id" TEXT NOT NULL,
    "drawingId" TEXT NOT NULL,
    "page" INTEGER NOT NULL DEFAULT 1,
    "kind" "DrawingMarkupKind" NOT NULL,
    "geometry" JSONB NOT NULL,
    "colour" TEXT NOT NULL DEFAULT '#dc2626',
    "strokeWidth" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "text" TEXT,
    "mmPerPoint" DOUBLE PRECISION,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "drawing_markups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drawing_comments" (
    "companyId" TEXT,
    "id" TEXT NOT NULL,
    "drawingId" TEXT NOT NULL,
    "page" INTEGER NOT NULL DEFAULT 1,
    "x" DOUBLE PRECISION,
    "y" DOUBLE PRECISION,
    "body" TEXT NOT NULL,
    "status" "DrawingCommentStatus" NOT NULL DEFAULT 'OPEN',
    "parentId" TEXT,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "assignedToId" TEXT,
    "assignedToName" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "drawing_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "drawing_markups_companyId_drawingId_page_idx" ON "drawing_markups"("companyId", "drawingId", "page");
CREATE INDEX "drawing_markups_companyId_authorId_idx" ON "drawing_markups"("companyId", "authorId");
CREATE INDEX "drawing_comments_companyId_drawingId_page_idx" ON "drawing_comments"("companyId", "drawingId", "page");
CREATE INDEX "drawing_comments_companyId_status_idx" ON "drawing_comments"("companyId", "status");
CREATE INDEX "drawing_comments_companyId_assignedToId_idx" ON "drawing_comments"("companyId", "assignedToId");

-- AddForeignKey
ALTER TABLE "drawing_markups" ADD CONSTRAINT "drawing_markups_drawingId_fkey"
  FOREIGN KEY ("drawingId") REFERENCES "drawings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drawing_comments" ADD CONSTRAINT "drawing_comments_drawingId_fkey"
  FOREIGN KEY ("drawingId") REFERENCES "drawings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drawing_comments" ADD CONSTRAINT "drawing_comments_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "drawing_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep the Data API locked out (see 0012). A review comment is one practice
-- saying what is wrong with another's drawing — the last thing that should be
-- readable over /rest/v1.
ALTER TABLE "drawing_markups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "drawing_comments" ENABLE ROW LEVEL SECURITY;
