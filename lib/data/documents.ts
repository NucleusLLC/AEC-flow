/**
 * Documents data-access layer — the cross-cutting "all documents" library
 * (drawings, presentations, reports, specs, contracts, spreadsheets).
 *
 * IMPORTANT (single-tenant -> SaaS hedge): pages call functions from this module
 * rather than touching Prisma directly. Live version maps to `Attachment` rows
 * (mimeType → kind/fileType) across projects + practice-level docs. Placeholder
 * data for now; project names match `lib/data/projects.ts`.
 */

export type DocKind =
  | "DRAWING"
  | "PRESENTATION"
  | "REPORT"
  | "DOCUMENT"
  | "CONTRACT"
  | "SPREADSHEET";

export type FileType = "PDF" | "DWG" | "RVT" | "PPTX" | "DOCX" | "XLSX";

export type DocumentItem = {
  id: string;
  name: string;
  kind: DocKind;
  fileType: FileType;
  projectId: string | null;
  projectName: string | null;
  owner: string;
  updatedAt: string; // ISO yyyy-mm-dd
  sizeKb: number;
  version: string;
};

export type DocumentsSummary = {
  total: number;
  byKind: Record<DocKind, number>;
  projects: number;
};

export const DOC_KIND_LABEL: Record<DocKind, string> = {
  DRAWING: "Drawing",
  PRESENTATION: "Presentation",
  REPORT: "Report",
  DOCUMENT: "Document",
  CONTRACT: "Contract",
  SPREADSHEET: "Spreadsheet",
};

const DOCUMENTS: DocumentItem[] = [
  { id: "doc1", name: "Marina Heights — Concept Design Presentation", kind: "PRESENTATION", fileType: "PPTX", projectId: "ZA-2026-014", projectName: "Marina Heights Tower — Phase 2", owner: "Idris Mansour", updatedAt: "2026-02-18", sizeKb: 14200, version: "v3" },
  { id: "doc2", name: "Marina Heights — Schematic Design Report", kind: "REPORT", fileType: "PDF", projectId: "ZA-2026-014", projectName: "Marina Heights Tower — Phase 2", owner: "Layla Hassan", updatedAt: "2026-04-12", sizeKb: 3800, version: "v1" },
  { id: "doc3", name: "Marina Heights — Fee Schedule", kind: "SPREADSHEET", fileType: "XLSX", projectId: "ZA-2026-014", projectName: "Marina Heights Tower — Phase 2", owner: "Layla Hassan", updatedAt: "2026-01-20", sizeKb: 240, version: "v2" },
  { id: "doc4", name: "Marina Heights — Bill of Quantities", kind: "SPREADSHEET", fileType: "XLSX", projectId: "ZA-2026-014", projectName: "Marina Heights Tower — Phase 2", owner: "Wei Chen", updatedAt: "2026-05-20", sizeKb: 880, version: "v1" },
  { id: "doc5", name: "Saadiyat — Heritage Submission Pack", kind: "DOCUMENT", fileType: "PDF", projectId: "ZA-2026-011", projectName: "Saadiyat Cultural Pavilion", owner: "Omar Farouk", updatedAt: "2026-06-17", sizeKb: 9600, version: "v2" },
  { id: "doc6", name: "Saadiyat — Concept Presentation", kind: "PRESENTATION", fileType: "PPTX", projectId: "ZA-2026-011", projectName: "Saadiyat Cultural Pavilion", owner: "Hana Yusuf", updatedAt: "2026-04-14", sizeKb: 22800, version: "v4" },
  { id: "doc7", name: "Saadiyat — Pavilion GA Drawing", kind: "DRAWING", fileType: "PDF", projectId: "ZA-2026-011", projectName: "Saadiyat Cultural Pavilion", owner: "Hana Yusuf", updatedAt: "2026-06-02", sizeKb: 2210, version: "Rev A" },
  { id: "doc8", name: "Emirates Hills — Interior Concept Deck", kind: "PRESENTATION", fileType: "PPTX", projectId: "ZA-2026-006", projectName: "Emirates Hills Private Villa", owner: "Tom Becker", updatedAt: "2026-04-18", sizeKb: 18400, version: "v2" },
  { id: "doc9", name: "Emirates Hills — Material Specification", kind: "DOCUMENT", fileType: "DOCX", projectId: "ZA-2026-006", projectName: "Emirates Hills Private Villa", owner: "Hana Yusuf", updatedAt: "2026-05-02", sizeKb: 680, version: "v1" },
  { id: "doc10", name: "Downtown Retail — Cost Report", kind: "REPORT", fileType: "XLSX", projectId: "ZA-2025-097", projectName: "Downtown Retail Fit-out", owner: "Layla Hassan", updatedAt: "2026-05-05", sizeKb: 410, version: "v3" },
  { id: "doc11", name: "Downtown Retail — Snagging Report", kind: "REPORT", fileType: "PDF", projectId: "ZA-2025-097", projectName: "Downtown Retail Fit-out", owner: "Layla Hassan", updatedAt: "2026-06-12", sizeKb: 1500, version: "v1" },
  { id: "doc12", name: "Appointment Agreement — Emaar", kind: "CONTRACT", fileType: "PDF", projectId: "ZA-2026-014", projectName: "Marina Heights Tower — Phase 2", owner: "Greg Lacle", updatedAt: "2026-01-10", sizeKb: 520, version: "Signed" },
  { id: "doc13", name: "Appointment Agreement — DCT Abu Dhabi", kind: "CONTRACT", fileType: "PDF", projectId: "ZA-2026-011", projectName: "Saadiyat Cultural Pavilion", owner: "Greg Lacle", updatedAt: "2026-03-04", sizeKb: 540, version: "Signed" },
  { id: "doc14", name: "Meeting Minutes — Jumeirah Villas", kind: "DOCUMENT", fileType: "DOCX", projectId: "ZA-2026-008", projectName: "Jumeirah Villas Community", owner: "Sara Khan", updatedAt: "2026-05-22", sizeKb: 120, version: "v1" },
  { id: "doc15", name: "Practice — Monthly Portfolio Report (June)", kind: "REPORT", fileType: "PDF", projectId: null, projectName: null, owner: "Greg Lacle", updatedAt: "2026-06-01", sizeKb: 2600, version: "v1" },
  { id: "doc16", name: "ZenArch — Company Profile", kind: "DOCUMENT", fileType: "PDF", projectId: null, projectName: null, owner: "Mariam Al Suwaidi", updatedAt: "2026-02-01", sizeKb: 7400, version: "2026" },
];

export async function getDocuments(): Promise<DocumentItem[]> {
  return [...DOCUMENTS].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function summarizeDocuments(list: DocumentItem[]): DocumentsSummary {
  const byKind = { DRAWING: 0, PRESENTATION: 0, REPORT: 0, DOCUMENT: 0, CONTRACT: 0, SPREADSHEET: 0 } as Record<DocKind, number>;
  for (const d of list) byKind[d.kind] += 1;
  return {
    total: list.length,
    byKind,
    projects: new Set(list.map((d) => d.projectId).filter(Boolean)).size,
  };
}

/** KB → human size, shared by views. */
export function formatFileSize(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}
