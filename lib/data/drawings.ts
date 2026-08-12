/**
 * Drawings data-access layer (the per-project drawing register).
 *
 * SERVER-ONLY — it queries Prisma. Types, labels and `summarizeDrawings` live in
 * `./drawings.types.ts` so client components can import those without pulling
 * the database client into the browser bundle.
 *
 * WAS PLACEHOLDER, NOW REAL. Until the `Drawing` table existed this module
 * returned thirteen invented rows. Every query below is company-scoped by the
 * Prisma tenant extension in lib/db.ts — `Drawing` is in TENANT_MODELS, so
 * there is no `where: { companyId }` to forget here.
 */

import "server-only";
import { prisma } from "@/lib/db";
import type { Discipline, Drawing, DrawingStatus, FileType } from "./drawings.types";

export * from "./drawings.types";

/** Prisma row shape this module reads. Kept explicit so a schema change that
 *  drops a column fails here, at the seam, rather than at a call site. */
type DrawingRow = {
  id: string;
  sheetNumber: string;
  title: string;
  projectId: string;
  discipline: string;
  status: string;
  revision: string;
  fileType: string;
  sizeBytes: number;
  storageKey: string;
  uploadedByName: string | null;
  uploadedAt: Date;
  project: { projectNumber: string; name: string } | null;
};

const SELECT = {
  id: true,
  sheetNumber: true,
  title: true,
  projectId: true,
  discipline: true,
  status: true,
  revision: true,
  fileType: true,
  sizeBytes: true,
  storageKey: true,
  uploadedByName: true,
  uploadedAt: true,
  project: { select: { projectNumber: true, name: true } },
} as const;

function toDrawing(row: DrawingRow): Drawing {
  return {
    id: row.id,
    code: row.sheetNumber,
    title: row.title,
    projectId: row.projectId,
    projectNumber: row.project?.projectNumber ?? "—",
    projectName: row.project?.name ?? "—",
    discipline: row.discipline as Discipline,
    status: row.status as DrawingStatus,
    revision: row.revision,
    fileType: row.fileType as FileType,
    sizeKb: Math.max(1, Math.round(row.sizeBytes / 1024)),
    uploadedBy: row.uploadedByName ?? "—",
    uploadedAt: row.uploadedAt.toISOString().slice(0, 10),
    hasFile: row.storageKey.length > 0,
  };
}

export async function getDrawings(): Promise<Drawing[]> {
  const rows = await prisma.drawing.findMany({
    select: SELECT,
    orderBy: [{ uploadedAt: "desc" }, { sheetNumber: "asc" }],
  });
  return rows.map(toDrawing);
}

export async function getProjectDrawings(projectId: string): Promise<Drawing[]> {
  const rows = await prisma.drawing.findMany({
    where: { projectId },
    select: SELECT,
    orderBy: [{ sheetNumber: "asc" }, { revision: "desc" }],
  });
  return rows.map(toDrawing);
}

/** One row, or null when it does not exist or belongs to another company. */
export async function getDrawing(id: string): Promise<Drawing | null> {
  const row = await prisma.drawing.findUnique({ where: { id }, select: SELECT });
  return row ? toDrawing(row) : null;
}
