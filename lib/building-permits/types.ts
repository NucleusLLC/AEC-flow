/**
 * Building Permit module — client-safe types and label tables.
 *
 * CLIENT-SAFE. No Prisma import, no "server-only": a client component renders
 * these labels, and importing the generated Prisma enums here would drag the
 * client bundle into the server. The unions below mirror the schema's enums
 * exactly; `lib/building-permits/enums.test.ts` fails the build if they drift.
 */

export type BuildingPermitType =
  | "NEW_BUILD"
  | "RENOVATION"
  | "EXTENSION"
  | "DEMOLITION"
  | "CHANGE_OF_USE"
  | "FENCE_WALL"
  | "POOL"
  | "SIGNAGE"
  | "TEMPORARY"
  | "SPLIT_PARCEL"
  | "OTHER";

export type BuildingPermitStatus =
  | "DRAFT"
  | "PREPARING"
  | "SUBMITTED"
  | "IN_REVIEW"
  | "INFO_REQUESTED"
  | "CONCEPT_APPROVED"
  | "RESUBMITTED"
  | "APPROVED"
  | "APPROVED_WITH_CONDITIONS"
  | "REJECTED"
  | "WITHDRAWN"
  | "ISSUED"
  | "EXPIRED";

export type BuildingPermitSubmissionMethod =
  | "COUNTER"
  | "EMAIL"
  | "PORTAL"
  | "COURIER"
  | "OTHER";

export type BuildingPermitCorrespondenceDirection = "INCOMING" | "OUTGOING";

export type BuildingPermitApprovalStage =
  | "CONCEPT"
  | "ZONING"
  | "TECHNICAL"
  | "FIRE"
  | "HEALTH"
  | "UTILITIES"
  | "FINAL"
  | "OTHER";

export type BuildingPermitApprovalStatus =
  | "PENDING"
  | "APPROVED"
  | "APPROVED_WITH_CONDITIONS"
  | "REJECTED"
  | "WITHDRAWN";

export type BuildingPermitDocumentCategory =
  | "APPLICATION_FORM"
  | "DRAWING"
  | "CALCULATION"
  | "LETTER"
  | "MINUTES"
  | "APPROVAL"
  | "PHOTO"
  | "RECEIPT"
  | "OTHER";

// ── Ordered lists (drive every <select> and every filter) ───────────────────

export const PERMIT_TYPES: BuildingPermitType[] = [
  "NEW_BUILD",
  "RENOVATION",
  "EXTENSION",
  "DEMOLITION",
  "CHANGE_OF_USE",
  "FENCE_WALL",
  "POOL",
  "SIGNAGE",
  "TEMPORARY",
  "SPLIT_PARCEL",
  "OTHER",
];

/** In the order an application is usually lived, not alphabetically. */
export const PERMIT_STATUSES: BuildingPermitStatus[] = [
  "DRAFT",
  "PREPARING",
  "SUBMITTED",
  "IN_REVIEW",
  "INFO_REQUESTED",
  "CONCEPT_APPROVED",
  "RESUBMITTED",
  "APPROVED",
  "APPROVED_WITH_CONDITIONS",
  "ISSUED",
  "REJECTED",
  "WITHDRAWN",
  "EXPIRED",
];

export const SUBMISSION_METHODS: BuildingPermitSubmissionMethod[] = [
  "COUNTER",
  "EMAIL",
  "PORTAL",
  "COURIER",
  "OTHER",
];

export const CORRESPONDENCE_DIRECTIONS: BuildingPermitCorrespondenceDirection[] = [
  "INCOMING",
  "OUTGOING",
];

export const APPROVAL_STAGES: BuildingPermitApprovalStage[] = [
  "CONCEPT",
  "ZONING",
  "TECHNICAL",
  "FIRE",
  "HEALTH",
  "UTILITIES",
  "FINAL",
  "OTHER",
];

export const APPROVAL_STATUSES: BuildingPermitApprovalStatus[] = [
  "PENDING",
  "APPROVED",
  "APPROVED_WITH_CONDITIONS",
  "REJECTED",
  "WITHDRAWN",
];

export const DOCUMENT_CATEGORIES: BuildingPermitDocumentCategory[] = [
  "APPLICATION_FORM",
  "DRAWING",
  "CALCULATION",
  "LETTER",
  "MINUTES",
  "APPROVAL",
  "PHOTO",
  "RECEIPT",
  "OTHER",
];

// ── Labels ─────────────────────────────────────────────────────────────────

export const PERMIT_TYPE_LABEL: Record<BuildingPermitType, string> = {
  NEW_BUILD: "New build",
  RENOVATION: "Renovation",
  EXTENSION: "Extension",
  DEMOLITION: "Demolition",
  CHANGE_OF_USE: "Change of use",
  FENCE_WALL: "Fence / wall",
  POOL: "Pool",
  SIGNAGE: "Signage",
  TEMPORARY: "Temporary",
  SPLIT_PARCEL: "Parcel split",
  OTHER: "Other",
};

export const PERMIT_STATUS_LABEL: Record<BuildingPermitStatus, string> = {
  DRAFT: "Draft",
  PREPARING: "Preparing",
  SUBMITTED: "Submitted",
  IN_REVIEW: "In review",
  INFO_REQUESTED: "Information requested",
  CONCEPT_APPROVED: "Concept approved",
  RESUBMITTED: "Resubmitted",
  APPROVED: "Approved",
  APPROVED_WITH_CONDITIONS: "Approved with conditions",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  ISSUED: "Permit issued",
  EXPIRED: "Expired",
};

export const SUBMISSION_METHOD_LABEL: Record<BuildingPermitSubmissionMethod, string> = {
  COUNTER: "At the counter",
  EMAIL: "Email",
  PORTAL: "Online portal",
  COURIER: "Courier",
  OTHER: "Other",
};

export const CORRESPONDENCE_DIRECTION_LABEL: Record<
  BuildingPermitCorrespondenceDirection,
  string
> = {
  INCOMING: "Received",
  OUTGOING: "Sent",
};

export const APPROVAL_STAGE_LABEL: Record<BuildingPermitApprovalStage, string> = {
  CONCEPT: "Concept approval",
  ZONING: "Zoning",
  TECHNICAL: "Technical review",
  FIRE: "Fire department",
  HEALTH: "Public health",
  UTILITIES: "Utilities",
  FINAL: "Final approval",
  OTHER: "Other",
};

export const APPROVAL_STATUS_LABEL: Record<BuildingPermitApprovalStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  APPROVED_WITH_CONDITIONS: "Approved with conditions",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

export const DOCUMENT_CATEGORY_LABEL: Record<BuildingPermitDocumentCategory, string> = {
  APPLICATION_FORM: "Application form",
  DRAWING: "Drawing",
  CALCULATION: "Calculation",
  LETTER: "Letter",
  MINUTES: "Meeting minutes",
  APPROVAL: "Approval",
  PHOTO: "Photo",
  RECEIPT: "Receipt",
  OTHER: "Other",
};

// ── Badge tones (the app's existing vocabulary — components/ui/badge.tsx) ───

export type BadgeTone = "neutral" | "blue" | "green" | "amber" | "red" | "violet" | "slate";

export const PERMIT_STATUS_TONE: Record<BuildingPermitStatus, BadgeTone> = {
  DRAFT: "slate",
  PREPARING: "slate",
  SUBMITTED: "blue",
  IN_REVIEW: "blue",
  INFO_REQUESTED: "amber",
  CONCEPT_APPROVED: "violet",
  RESUBMITTED: "blue",
  APPROVED: "green",
  APPROVED_WITH_CONDITIONS: "green",
  REJECTED: "red",
  WITHDRAWN: "slate",
  ISSUED: "green",
  EXPIRED: "red",
};

export const APPROVAL_STATUS_TONE: Record<BuildingPermitApprovalStatus, BadgeTone> = {
  PENDING: "amber",
  APPROVED: "green",
  APPROVED_WITH_CONDITIONS: "green",
  REJECTED: "red",
  WITHDRAWN: "slate",
};

/**
 * Statuses in which the file is finished — nothing is waiting on the authority
 * and nothing is waiting on us. Used by the register's "open" filter and by the
 * summary tiles.
 */
export const CLOSED_STATUSES: BuildingPermitStatus[] = [
  "APPROVED",
  "APPROVED_WITH_CONDITIONS",
  "ISSUED",
  "REJECTED",
  "WITHDRAWN",
  "EXPIRED",
];

export function isClosedStatus(status: BuildingPermitStatus): boolean {
  return CLOSED_STATUSES.includes(status);
}

// ── DTOs ───────────────────────────────────────────────────────────────────
//
// Dates cross this boundary as `YYYY-MM-DD` strings and timestamps as ISO
// strings. A Date instance cannot be handed from a server component to a client
// one without being serialised anyway, and a half-serialised shape is how a
// register ends up rendering "Invalid Date".

export type BuildingPermitSubmissionDTO = {
  id: string;
  permitId: string;
  sequence: number;
  submittedAt: string;
  method: BuildingPermitSubmissionMethod;
  receivedBy: string | null;
  receiptNumber: string | null;
  contents: string | null;
  notes: string | null;
  createdByName: string | null;
  createdAt: string;
};

export type BuildingPermitMeetingDTO = {
  id: string;
  permitId: string;
  heldAt: string;
  subject: string;
  location: string | null;
  attendees: string | null;
  minutes: string | null;
  decisions: string | null;
  followUp: string | null;
  createdByName: string | null;
  createdAt: string;
};

export type BuildingPermitCorrespondenceDTO = {
  id: string;
  permitId: string;
  direction: BuildingPermitCorrespondenceDirection;
  letterRef: string | null;
  party: string | null;
  subject: string;
  letterDate: string | null;
  receivedAt: string | null;
  summary: string | null;
  requiresResponse: boolean;
  responseDueAt: string | null;
  respondedAt: string | null;
  createdByName: string | null;
  createdAt: string;
  /** The letter as a PDF, when one was attached. */
  pdf: PermitLetterPdf | null;
};

/** Just enough of a letter's stored PDF to link to it — never the storage key. */
export type PermitLetterPdf = {
  documentId: string;
  filename: string | null;
  sizeBytes: number | null;
};

/** One letter as the register shows it: which way, when, what, and its PDF. */
export type PermitLetterSummary = {
  id: string;
  direction: BuildingPermitCorrespondenceDirection;
  letterRef: string | null;
  subject: string;
  letterDate: string | null;
  pdf: PermitLetterPdf | null;
};

export type BuildingPermitApprovalDTO = {
  id: string;
  permitId: string;
  stage: BuildingPermitApprovalStage;
  status: BuildingPermitApprovalStatus;
  decidedAt: string | null;
  refNumber: string | null;
  validUntil: string | null;
  conditions: string | null;
  notes: string | null;
  createdByName: string | null;
  createdAt: string;
};

export type BuildingPermitDocumentDTO = {
  id: string;
  permitId: string;
  name: string;
  category: BuildingPermitDocumentCategory;
  storageKey: string | null;
  externalUrl: string | null;
  filename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  documentDate: string | null;
  uploadedByName: string | null;
  notes: string | null;
  /** Set when this file is a letter's PDF rather than a loose file on the case. */
  correspondenceId: string | null;
  createdAt: string;
};

/** A row in the register. Everything the list and the printed list need. */
export type BuildingPermitSummaryDTO = {
  id: string;
  reference: string;
  permitNumber: string | null;
  title: string;
  permitType: BuildingPermitType;
  status: BuildingPermitStatus;
  projectId: string | null;
  projectName: string | null;
  clientName: string | null;
  applicantName: string | null;
  siteAddress: string | null;
  parcelNumber: string | null;
  authority: string | null;
  submittedAt: string | null;
  conceptApprovalAt: string | null;
  decisionAt: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  targetDecisionAt: string | null;
  responsibleName: string | null;
  /** Counts, so the register can say "3 letters, 1 unanswered" without a join. */
  submissionCount: number;
  meetingCount: number;
  correspondenceCount: number;
  documentCount: number;
  /** Set when an incoming letter needs an answer: the earliest unmet due date. */
  openResponseDueAt: string | null;
  /** The date of the most recent submission (the current version), or null. */
  latestSubmissionAt: string | null;
  /** Every letter on the file, newest first, each with its PDF if there is one. */
  letters: PermitLetterSummary[];
  updatedAt: string;
};

export type BuildingPermitDTO = BuildingPermitSummaryDTO & {
  description: string | null;
  clientId: string | null;
  landRegistry: string | null;
  authorityContact: string | null;
  authorityEmail: string | null;
  lotAreaM2: number | null;
  builtAreaM2: number | null;
  estimatedValue: number | null;
  currency: string;
  acknowledgedAt: string | null;
  conceptApprovalRef: string | null;
  feeAmount: number | null;
  feePaidAt: string | null;
  responsibleId: string | null;
  notes: string | null;
  createdByName: string | null;
  createdAt: string;
  submissions: BuildingPermitSubmissionDTO[];
  meetings: BuildingPermitMeetingDTO[];
  correspondence: BuildingPermitCorrespondenceDTO[];
  approvals: BuildingPermitApprovalDTO[];
  documents: BuildingPermitDocumentDTO[];
};

// ── Write inputs ───────────────────────────────────────────────────────────

export type BuildingPermitInput = {
  /** Blank means "assign the next reference in the practice sequence". */
  reference?: string;
  permitNumber?: string | null;
  title: string;
  permitType: BuildingPermitType;
  status: BuildingPermitStatus;
  description?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  applicantName?: string | null;
  siteAddress?: string | null;
  parcelNumber?: string | null;
  landRegistry?: string | null;
  authority?: string | null;
  authorityContact?: string | null;
  authorityEmail?: string | null;
  lotAreaM2?: number | null;
  builtAreaM2?: number | null;
  estimatedValue?: number | null;
  currency?: string;
  submittedAt?: string | null;
  acknowledgedAt?: string | null;
  conceptApprovalAt?: string | null;
  conceptApprovalRef?: string | null;
  decisionAt?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  targetDecisionAt?: string | null;
  feeAmount?: number | null;
  feePaidAt?: string | null;
  responsibleId?: string | null;
  responsibleName?: string | null;
  notes?: string | null;
};

export type BuildingPermitSubmissionInput = {
  submittedAt: string;
  method: BuildingPermitSubmissionMethod;
  receivedBy?: string | null;
  receiptNumber?: string | null;
  contents?: string | null;
  notes?: string | null;
};

export type BuildingPermitMeetingInput = {
  heldAt: string;
  subject: string;
  location?: string | null;
  attendees?: string | null;
  minutes?: string | null;
  decisions?: string | null;
  followUp?: string | null;
};

export type BuildingPermitCorrespondenceInput = {
  direction: BuildingPermitCorrespondenceDirection;
  letterRef?: string | null;
  party?: string | null;
  subject: string;
  letterDate?: string | null;
  receivedAt?: string | null;
  summary?: string | null;
  requiresResponse: boolean;
  responseDueAt?: string | null;
  respondedAt?: string | null;
};

export type BuildingPermitApprovalInput = {
  stage: BuildingPermitApprovalStage;
  status: BuildingPermitApprovalStatus;
  decidedAt?: string | null;
  refNumber?: string | null;
  validUntil?: string | null;
  conditions?: string | null;
  notes?: string | null;
};

export type BuildingPermitDocumentInput = {
  name: string;
  category: BuildingPermitDocumentCategory;
  storageKey?: string | null;
  externalUrl?: string | null;
  filename?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  documentDate?: string | null;
  notes?: string | null;
};

// ── Register filters ───────────────────────────────────────────────────────

export type PermitRegisterFilter = {
  status?: BuildingPermitStatus | "ALL" | "OPEN";
  permitType?: BuildingPermitType | "ALL";
  projectId?: string;
  authority?: string;
  /** Free text over reference, permit number, title, address, parcel, applicant. */
  q?: string;
};
