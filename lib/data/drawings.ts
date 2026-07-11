/**
 * Drawings data-access layer (the per-project "drawings bin" / plans library).
 *
 * IMPORTANT (single-tenant -> SaaS hedge): pages call functions from this module
 * rather than touching Prisma directly. Live version maps to `Attachment` rows
 * scoped by `projectId` (mimeType/url/size already on that model). Placeholder
 * data for now; project numbers/names match `lib/data/projects.ts`.
 */

export type DrawingStatus = "DRAFT" | "FOR_REVIEW" | "APPROVED" | "ISSUED" | "SUPERSEDED";
export type Discipline =
  | "ARCHITECTURE"
  | "STRUCTURAL"
  | "INTERIOR"
  | "MEP"
  | "PROJECT_MANAGEMENT"
  | "CONSTRUCTION";
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
  PROJECT_MANAGEMENT: "Project Mgmt",
  CONSTRUCTION: "Construction",
};

export const DRAWING_STATUS_LABEL: Record<DrawingStatus, string> = {
  DRAFT: "Draft",
  FOR_REVIEW: "For review",
  APPROVED: "Approved",
  ISSUED: "Issued",
  SUPERSEDED: "Superseded",
};

const DRAWINGS: Drawing[] = [
  // Marina Heights Tower — Phase 2
  { id: "d1", code: "A-101", title: "Ground Floor Plan", projectId: "ZA-2026-014", projectNumber: "ZA-2026-014", projectName: "Marina Heights Tower — Phase 2", discipline: "ARCHITECTURE", status: "APPROVED", revision: "C", fileType: "PDF", sizeKb: 2480, uploadedBy: "Idris Mansour", uploadedAt: "2026-04-08" },
  { id: "d2", code: "A-201", title: "North & East Elevations", projectId: "ZA-2026-014", projectNumber: "ZA-2026-014", projectName: "Marina Heights Tower — Phase 2", discipline: "ARCHITECTURE", status: "FOR_REVIEW", revision: "B", fileType: "PDF", sizeKb: 1850, uploadedBy: "Idris Mansour", uploadedAt: "2026-05-22" },
  { id: "d3", code: "S-301", title: "Foundation Layout", projectId: "ZA-2026-014", projectNumber: "ZA-2026-014", projectName: "Marina Heights Tower — Phase 2", discipline: "STRUCTURAL", status: "APPROVED", revision: "B", fileType: "DWG", sizeKb: 5120, uploadedBy: "Wei Chen", uploadedAt: "2026-04-30" },
  { id: "d4", code: "M-401", title: "HVAC Layout — Level 1", projectId: "ZA-2026-014", projectNumber: "ZA-2026-014", projectName: "Marina Heights Tower — Phase 2", discipline: "MEP", status: "DRAFT", revision: "A", fileType: "DWG", sizeKb: 3320, uploadedBy: "Nadia Roy", uploadedAt: "2026-05-18" },
  // Saadiyat Cultural Pavilion
  { id: "d5", code: "A-100", title: "Site Plan", projectId: "ZA-2026-011", projectNumber: "ZA-2026-011", projectName: "Saadiyat Cultural Pavilion", discipline: "ARCHITECTURE", status: "ISSUED", revision: "A", fileType: "PDF", sizeKb: 2960, uploadedBy: "Hana Yusuf", uploadedAt: "2026-04-12" },
  { id: "d6", code: "A-205", title: "Pavilion Sections", projectId: "ZA-2026-011", projectNumber: "ZA-2026-011", projectName: "Saadiyat Cultural Pavilion", discipline: "ARCHITECTURE", status: "FOR_REVIEW", revision: "A", fileType: "PDF", sizeKb: 2210, uploadedBy: "Hana Yusuf", uploadedAt: "2026-06-02" },
  { id: "d7", code: "S-300", title: "Steel Frame Concept", projectId: "ZA-2026-011", projectNumber: "ZA-2026-011", projectName: "Saadiyat Cultural Pavilion", discipline: "STRUCTURAL", status: "DRAFT", revision: "A", fileType: "RVT", sizeKb: 8800, uploadedBy: "Wei Chen", uploadedAt: "2026-06-10" },
  // Emirates Hills Private Villa
  { id: "d8", code: "A-101", title: "Ground Floor Plan", projectId: "ZA-2026-006", projectNumber: "ZA-2026-006", projectName: "Emirates Hills Private Villa", discipline: "ARCHITECTURE", status: "APPROVED", revision: "B", fileType: "PDF", sizeKb: 1620, uploadedBy: "Hana Yusuf", uploadedAt: "2026-03-05" },
  { id: "d9", code: "ID-501", title: "Interior Layout & Finishes", projectId: "ZA-2026-006", projectNumber: "ZA-2026-006", projectName: "Emirates Hills Private Villa", discipline: "INTERIOR", status: "APPROVED", revision: "A", fileType: "PDF", sizeKb: 2040, uploadedBy: "Tom Becker", uploadedAt: "2026-04-18" },
  { id: "d10", code: "S-301", title: "Structural GA", projectId: "ZA-2026-006", projectNumber: "ZA-2026-006", projectName: "Emirates Hills Private Villa", discipline: "STRUCTURAL", status: "FOR_REVIEW", revision: "A", fileType: "DWG", sizeKb: 4400, uploadedBy: "Wei Chen", uploadedAt: "2026-06-12" },
  // Downtown Retail Fit-out
  { id: "d11", code: "ID-101", title: "Concourse Layout", projectId: "ZA-2025-097", projectNumber: "ZA-2025-097", projectName: "Downtown Retail Fit-out", discipline: "INTERIOR", status: "ISSUED", revision: "C", fileType: "PDF", sizeKb: 1990, uploadedBy: "Tom Becker", uploadedAt: "2026-01-10" },
  { id: "d12", code: "M-201", title: "MEP Coordination Model", projectId: "ZA-2025-097", projectNumber: "ZA-2025-097", projectName: "Downtown Retail Fit-out", discipline: "MEP", status: "APPROVED", revision: "B", fileType: "DWG", sizeKb: 6100, uploadedBy: "Nadia Roy", uploadedAt: "2026-05-05" },
  { id: "d13", code: "ID-102", title: "Storefront Details", projectId: "ZA-2025-097", projectNumber: "ZA-2025-097", projectName: "Downtown Retail Fit-out", discipline: "INTERIOR", status: "SUPERSEDED", revision: "A", fileType: "PDF", sizeKb: 1450, uploadedBy: "Tom Becker", uploadedAt: "2026-02-12" },
];

export async function getDrawings(): Promise<Drawing[]> {
  return [...DRAWINGS].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function getProjectDrawings(projectId: string): Promise<Drawing[]> {
  return DRAWINGS.filter((d) => d.projectId === projectId).sort((a, b) =>
    b.uploadedAt.localeCompare(a.uploadedAt),
  );
}

export function summarizeDrawings(list: Drawing[]): DrawingsSummary {
  return {
    total: list.length,
    approved: list.filter((d) => d.status === "APPROVED" || d.status === "ISSUED").length,
    forReview: list.filter((d) => d.status === "FOR_REVIEW").length,
    projects: new Set(list.map((d) => d.projectId)).size,
  };
}
