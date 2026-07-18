import type { MaterialSelectionStatus } from "@prisma/client";

export type { MaterialSelectionStatus };

export interface MaterialSelectionDTO {
  id: string;
  tag: string;
  projectId: string | null;
  projectName: string | null;
  category: string;
  location: string | null;
  productName: string;
  manufacturer: string | null;
  modelNumber: string | null;
  finish: string | null;
  specification: string | null;
  status: MaterialSelectionStatus;
  currency: string;
  quantity: number;
  unit: string | null;
  unitCost: number;
  totalCost: number;
  supplier: string | null;
  purchaseOrderId: string | null;
  approvedBy: string | null;
  selectedDate: string | null;
  notes: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialSelectionInput {
  projectId?: string | null;
  projectName?: string | null;
  category: string;
  location?: string | null;
  productName: string;
  manufacturer?: string | null;
  modelNumber?: string | null;
  finish?: string | null;
  specification?: string | null;
  status?: MaterialSelectionStatus;
  currency?: string;
  quantity?: number;
  unit?: string | null;
  unitCost?: number;
  supplier?: string | null;
  purchaseOrderId?: string | null;
  approvedBy?: string | null;
  selectedDate?: string | null;
  notes?: string | null;
}

export const MATERIAL_STATUSES: MaterialSelectionStatus[] = [
  "PROPOSED",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "ORDERED",
  "INSTALLED",
];

export const MATERIAL_STATUS_LABEL: Record<MaterialSelectionStatus, string> = {
  PROPOSED: "Proposed",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  ORDERED: "Ordered",
  INSTALLED: "Installed",
};

/** Common finish-schedule categories offered in the picker (free text still allowed). */
export const MATERIAL_CATEGORIES = [
  "Flooring",
  "Wall Finish",
  "Ceiling",
  "Paint & Coatings",
  "Tile & Stone",
  "Millwork & Cabinetry",
  "Countertops",
  "Doors & Hardware",
  "Windows & Glazing",
  "Plumbing Fixtures",
  "Lighting",
  "Appliances",
  "Roofing",
  "Insulation",
  "Structural",
  "Landscape",
  "Other",
];
