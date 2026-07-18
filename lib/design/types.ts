import type {
  DesignDiscipline,
  DeliverableType,
  DeliverableStatus,
} from "@prisma/client";

export type { DesignDiscipline, DeliverableType, DeliverableStatus };

export interface DesignDeliverableDTO {
  id: string;
  number: string;
  title: string;
  discipline: DesignDiscipline;
  type: DeliverableType;
  revision: string;
  status: DeliverableStatus;
  projectId: string | null;
  projectName: string | null;
  scale: string | null;
  sheetSize: string | null;
  issuedTo: string | null;
  issuedDate: string | null;
  dueDate: string | null;
  fileLink: string | null;
  notes: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DesignDeliverableInput {
  number: string;
  title: string;
  discipline: DesignDiscipline;
  type?: DeliverableType;
  revision?: string;
  status?: DeliverableStatus;
  projectId?: string | null;
  projectName?: string | null;
  scale?: string | null;
  sheetSize?: string | null;
  issuedTo?: string | null;
  issuedDate?: string | null;
  dueDate?: string | null;
  fileLink?: string | null;
  notes?: string | null;
}

export const DISCIPLINES: DesignDiscipline[] = ["ARCHITECTURE", "ENGINEERING", "INTERIOR"];

export const DISCIPLINE_LABEL: Record<DesignDiscipline, string> = {
  ARCHITECTURE: "Architecture",
  ENGINEERING: "Engineering",
  INTERIOR: "Interior Design",
};

/** URL slug ↔ discipline enum, for the /design/[discipline] routes. */
export const DISCIPLINE_SLUG: Record<DesignDiscipline, string> = {
  ARCHITECTURE: "architecture",
  ENGINEERING: "engineering",
  INTERIOR: "interior",
};

export function disciplineFromSlug(slug: string): DesignDiscipline | null {
  const entry = (Object.entries(DISCIPLINE_SLUG) as [DesignDiscipline, string][]).find(
    ([, s]) => s === slug,
  );
  return entry ? entry[0] : null;
}

export const DELIVERABLE_TYPES: DeliverableType[] = [
  "DRAWING",
  "SPECIFICATION",
  "REPORT",
  "MODEL",
  "SCHEDULE",
];

export const DELIVERABLE_TYPE_LABEL: Record<DeliverableType, string> = {
  DRAWING: "Drawing",
  SPECIFICATION: "Specification",
  REPORT: "Report",
  MODEL: "Model",
  SCHEDULE: "Schedule",
};

export const DELIVERABLE_STATUSES: DeliverableStatus[] = [
  "DRAFT",
  "IN_REVIEW",
  "ISSUED",
  "SUPERSEDED",
  "APPROVED",
];

export const DELIVERABLE_STATUS_LABEL: Record<DeliverableStatus, string> = {
  DRAFT: "Draft",
  IN_REVIEW: "In review",
  ISSUED: "Issued",
  SUPERSEDED: "Superseded",
  APPROVED: "Approved",
};
