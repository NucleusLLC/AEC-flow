-- CreateEnum
CREATE TYPE "DrawingDiscipline" AS ENUM ('ARCHITECTURE', 'STRUCTURAL', 'INTERIOR', 'MEP', 'CIVIL', 'LANDSCAPE', 'PROJECT_MANAGEMENT', 'CONSTRUCTION', 'GENERAL');

-- CreateEnum
CREATE TYPE "DrawingRegisterStatus" AS ENUM ('DRAFT', 'FOR_REVIEW', 'APPROVED', 'ISSUED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "DrawingFileType" AS ENUM ('PDF', 'DWG', 'RVT');

-- CreateTable
CREATE TABLE "drawings" (
    "companyId" TEXT,
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sheetNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "discipline" "DrawingDiscipline" NOT NULL DEFAULT 'ARCHITECTURE',
    "sheetDiscipline" TEXT,
    "revision" TEXT NOT NULL DEFAULT '-',
    "status" "DrawingRegisterStatus" NOT NULL DEFAULT 'DRAFT',
    "issueDate" TIMESTAMP(3),
    "storageKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "fileType" "DrawingFileType" NOT NULL DEFAULT 'PDF',
    "extractionAudit" JSONB,
    "supersededById" TEXT,
    "uploadedById" TEXT,
    "uploadedByName" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drawings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "drawings_companyId_idx" ON "drawings"("companyId");

-- CreateIndex
CREATE INDEX "drawings_projectId_idx" ON "drawings"("projectId");

-- CreateIndex
CREATE INDEX "drawings_status_idx" ON "drawings"("status");

-- CreateIndex
CREATE INDEX "drawings_discipline_idx" ON "drawings"("discipline");

-- CreateIndex
CREATE UNIQUE INDEX "drawings_companyId_projectId_sheetNumber_revision_key" ON "drawings"("companyId", "projectId", "sheetNumber", "revision");

-- AddForeignKey
ALTER TABLE "drawings" ADD CONSTRAINT "drawings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

