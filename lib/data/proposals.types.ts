/**
 * Proposals — client-safe types, label maps, and PURE helpers.
 *
 * This sibling of lib/data/proposals.ts must NEVER import "@/lib/db" (or any
 * Prisma runtime), so it is safe to import from `"use client"` components.
 * The Prisma-backed query functions live in lib/data/proposals.ts and re-export
 * everything here via `export * from "./proposals.types"`.
 */

export type ProposalStatus =
  | "DRAFT"
  | "SENT"
  | "PENDING"
  | "APPROVED"
  | "ON_HOLD"
  | "REJECTED"
  | "VOID";

export type ProposalListItem = {
  id: string;
  refNumber: string;
  title: string;
  clientName: string;
  owner: string;
  status: ProposalStatus;
  revision: number;
  totalFee: number;
  currency: string;
  sentAt: string | null;
  validUntil: string | null;
  followUpDate: string | null;
  nextAction: string | null;
  createdAt: string;
};

export type ProposalsSummary = {
  total: number;
  openCount: number;
  openValue: number;
  awaitingCount: number;
  awaitingValue: number;
  wonValue: number;
  winRate: number;
};

export const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  PENDING: "Pending",
  APPROVED: "Approved",
  ON_HOLD: "On hold",
  REJECTED: "Rejected",
  VOID: "Void",
};

const OPEN: ProposalStatus[] = ["DRAFT", "SENT", "PENDING", "ON_HOLD"];
export const isOpenProposal = (s: ProposalStatus) => OPEN.includes(s);

export type Discipline =
  | "ARCHITECTURE"
  | "STRUCTURAL"
  | "INTERIOR"
  | "MEP"
  | "PROJECT_MANAGEMENT";

export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  ARCHITECTURE: "Architecture",
  STRUCTURAL: "Structural",
  INTERIOR: "Interior",
  MEP: "MEP",
  PROJECT_MANAGEMENT: "Project Management",
};

export type ProposalLineItem = {
  id: string;
  description: string;
  discipline: Discipline | null;
  amount: number;
  isOptional: boolean;
  sortOrder: number;
};

export type ProposalMilestone = {
  id: string;
  name: string;
  /** Share of the total fee invoiced at this milestone. */
  percentage: number;
  /** Week (from kickoff) the milestone is expected — optional. */
  dueWeek: number | null;
};

/** Detail-only fields, keyed by proposal id and merged onto the list row. */
type ProposalDetailExtra = {
  clientId: string;
  scopeSummary: string | null;
  exclusions: string | null;
  assumptions: string | null;
  terms: string | null;
  /** Estimated delivery duration in weeks. */
  estimatedDuration: number | null;
  approvedAt: string | null;
  lastContactDate: string | null;
  followUpNotes: string | null;
  /** Set once the proposal has been converted to an order. */
  orderNumber: string | null;
  lineItems: ProposalLineItem[];
  milestones: ProposalMilestone[];
};

/** Full record the detail page consumes = list row + detail extras. */
export type ProposalRecord = ProposalListItem & ProposalDetailExtra;

export function summarizeProposals(list: ProposalListItem[]): ProposalsSummary {
  const open = list.filter((p) => isOpenProposal(p.status));
  const awaiting = list.filter((p) => p.status === "PENDING");
  const approved = list.filter((p) => p.status === "APPROVED");
  const rejected = list.filter((p) => p.status === "REJECTED");
  const decided = approved.length + rejected.length;
  return {
    total: list.length,
    openCount: open.length,
    openValue: open.reduce((n, p) => n + p.totalFee, 0),
    awaitingCount: awaiting.length,
    awaitingValue: awaiting.reduce((n, p) => n + p.totalFee, 0),
    wonValue: approved.reduce((n, p) => n + p.totalFee, 0),
    winRate: decided > 0 ? Math.round((approved.length / decided) * 100) : 0,
  };
}

/**
 * Payload the create/edit form submits. `owner` is the display name (resolved to
 * a userId server-side); `validUntil` is "" or an ISO date. Client-safe (no
 * Prisma types) so the `"use client"` form can import it.
 */
export type ProposalWriteInput = {
  ref: string;
  title: string;
  clientId: string;
  owner: string;
  status: ProposalStatus;
  currency: string;
  validUntil: string;
  estimatedDuration: number | null;
  scopeSummary: string;
  exclusions: string;
  terms: string;
  totalFee: number;
  lineItems: {
    description: string;
    discipline: Discipline | null;
    amount: number;
    isOptional: boolean;
    sortOrder: number;
  }[];
  milestones: { name: string; percentage: number }[];
};

/** Total of the non-optional line items (the committed fee). */
export function committedFee(p: ProposalRecord): number {
  return p.lineItems.filter((li) => !li.isOptional).reduce((n, li) => n + li.amount, 0);
}

/** Sum of optional add-on line items. */
export function optionalFee(p: ProposalRecord): number {
  return p.lineItems.filter((li) => li.isOptional).reduce((n, li) => n + li.amount, 0);
}
