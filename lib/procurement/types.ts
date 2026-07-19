import type { PurchaseOrderStatus } from "@prisma/client";

export type { PurchaseOrderStatus };

/** A single ordered item. Stored as JSON on the PurchaseOrder row. */
export interface PurchaseOrderLine {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  /** Quantity received so far (receiving workflow). Absent/0 = nothing received. */
  receivedQty?: number;
}

export interface PurchaseOrderDTO {
  id: string;
  poNumber: string;
  projectId: string | null;
  projectName: string | null;
  vendorName: string;
  vendorContact: string | null;
  vendorEmail: string | null;
  status: PurchaseOrderStatus;
  currency: string;
  lineItems: PurchaseOrderLine[];
  subtotal: number;
  taxPercentage: number;
  shipping: number;
  total: number;
  orderDate: string | null;
  expectedDate: string | null;
  receivedDate: string | null;
  terms: string | null;
  notes: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderInput {
  projectId?: string | null;
  projectName?: string | null;
  vendorName: string;
  vendorContact?: string | null;
  vendorEmail?: string | null;
  status?: PurchaseOrderStatus;
  currency?: string;
  lineItems: PurchaseOrderLine[];
  taxPercentage?: number;
  shipping?: number;
  orderDate?: string | null;
  expectedDate?: string | null;
  receivedDate?: string | null;
  terms?: string | null;
  notes?: string | null;
}

export const PO_STATUSES: PurchaseOrderStatus[] = [
  "DRAFT",
  "ISSUED",
  "PARTIAL",
  "RECEIVED",
  "CLOSED",
  "CANCELLED",
];

export const PO_STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  DRAFT: "Draft",
  ISSUED: "Issued",
  PARTIAL: "Partially received",
  RECEIVED: "Received",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

/** Statuses that still count as committed/outstanding spend. */
export const PO_OPEN_STATUSES: PurchaseOrderStatus[] = ["DRAFT", "ISSUED", "PARTIAL"];
