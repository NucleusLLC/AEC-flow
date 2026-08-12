/**
 * Drawings register — types, labels and pure helpers.
 *
 * CLIENT-SAFE. This half of the module holds nothing that touches Prisma, so a
 * `"use client"` component can import it without dragging the database client
 * into the browser bundle. The queries live in `./drawings.ts`, which is
 * server-only. Same split as estimates / price-lists elsewhere in this repo.
 */

export type DrawingStatus = "DRAFT" | "FOR_REVIEW" | "APPROVED" | "ISSUED" | "SUPERSEDED";

/**
 * The register's vocabulary. Wider than the project-level `Discipline` enum:
 * civil, landscape and general-arrangement sheets are ordinary things to find
 * in a drawing set and had nowhere to go before, so intake was mapping them
 * into the nearest wrong bucket. The finer M/E/P reading the extractor can make
 * is preserved separately on the row (`sheetDiscipline`) rather than being
 * forced into this list — the register filters on discipline, and nobody filters
 * a set by "plumbing but not mechanical".
 */
export type Discipline =
  | "ARCHITECTURE"
  | "STRUCTURAL"
  | "INTERIOR"
  | "MEP"
  | "CIVIL"
  | "LANDSCAPE"
  | "PROJECT_MANAGEMENT"
  | "CONSTRUCTION"
  | "GENERAL";

export type FileType = "PDF" | "DWG" | "RVT";

export type Drawing = {
  id: string;
  code: string; // sheet number, e.g. A-101
  title: string;
  projectId: string;
  projectNumber: string;
  projectName: string;
  discipline: Discipline;
  status: DrawingStatus;
  revision: string; // e.g. "C"
  fileType: FileType;
  sizeKb: number;
  uploadedBy: string;
  uploadedAt: string; // ISO yyyy-mm-dd
  /** True once the bytes live in storage and can be downloaded. */
  hasFile: boolean;
};

export type DrawingsSummary = {
  total: number;
  approved: number; // APPROVED + ISSUED
  forReview: number;
  projects: number;
};

export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  ARCHITECTURE: "Architecture",
  STRUCTURAL: "Structural",
  INTERIOR: "Interior",
  MEP: "MEP",
  CIVIL: "Civil",
  LANDSCAPE: "Landscape",
  PROJECT_MANAGEMENT: "Project Mgmt",
  CONSTRUCTION: "Construction",
  GENERAL: "General",
};

export const DRAWING_STATUS_LABEL: Record<DrawingStatus, string> = {
  DRAFT: "Draft",
  FOR_REVIEW: "For review",
  APPROVED: "Approved",
  ISSUED: "Issued",
  SUPERSEDED: "Superseded",
};

export function summarizeDrawings(list: Drawing[]): DrawingsSummary {
  return {
    total: list.length,
    approved: list.filter((d) => d.status === "APPROVED" || d.status === "ISSUED").length,
    forReview: list.filter((d) => d.status === "FOR_REVIEW").length,
    projects: new Set(list.map((d) => d.projectId)).size,
  };
}
