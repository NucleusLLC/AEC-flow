/**
 * Construction Administration & Reporting — shared DTO types.
 *
 * These are plain, serializable shapes (numbers + ISO date strings) returned by
 * the data layer to server components and API routes. They deliberately do NOT
 * leak Prisma's Decimal/Date types — the repositories (lib/data/ca/*) map Prisma
 * rows to these DTOs, and the seed fallback (lib/ca/seed-data.ts) produces the
 * same shape. String-union enums mirror the Prisma enums one-to-one.
 */

export type CaReportType =
  | "DAILY"
  | "WEEKLY"
  | "BIWEEKLY"
  | "MONTHLY"
  | "EXECUTIVE"
  | "PROGRESS_CERTIFICATION"
  | "BANK_DRAW"
  | "COMPLETION";

export type CaReportStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "REVIEWED"
  | "APPROVED"
  | "ISSUED"
  | "ARCHIVED";

export type ChangeOrderStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "VOID";

export type CaDiscipline =
  | "ARCHITECTURAL"
  | "STRUCTURAL"
  | "MECHANICAL"
  | "ELECTRICAL"
  | "PLUMBING"
  | "CIVIL"
  | "OTHER";

export type RfiPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type RfiStatus = "OPEN" | "ANSWERED" | "CLOSED" | "VOID";
export type CertificationStatus = "DRAFT" | "ISSUED" | "APPROVED" | "ARCHIVED";
export type DelayStatus = "SUBMITTED" | "UNDER_REVIEW" | "ACCEPTED" | "REJECTED" | "CLOSED";
export type SubmittalStatus =
  | "REQUIRED"
  | "SUBMITTED"
  | "REVIEWED"
  | "APPROVED"
  | "APPROVED_AS_NOTED"
  | "REVISE_AND_RESUBMIT"
  | "REJECTED";
export type SiteInstructionStatus = "DRAFT" | "ISSUED" | "ACKNOWLEDGED" | "CLOSED";
export type ImpactLevel = "NONE" | "POSSIBLE" | "CONFIRMED";
export type PunchStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "VERIFIED" | "REJECTED";
/** Punch items reuse the suite-wide Priority enum (lib/.. Priority). */
export type PunchPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/** Cost inputs that drive the change-order calculation (see lib/ca/calc.ts). */
export type ChangeOrderCosts = {
  costLabor: number;
  costMaterial: number;
  costEquipment: number;
  costSubcontractor: number;
  overheadPercentage: number;
  profitPercentage: number;
  contingencyPercentage: number;
  vatPercentage: number;
};

export type ChangeOrder = ChangeOrderCosts & {
  id: string;
  projectId: string;
  projectName: string;
  changeOrderNumber: string;
  version: number;
  title: string;
  description: string | null;
  reason: string | null;
  requestedBy: string | null;
  contractor: string | null;
  architect: string | null;
  engineer: string | null;
  owner: string | null;
  status: ChangeOrderStatus;
  currency: string;
  totalCost: number;
  scheduleImpactDays: number;
  originalContractValue: number;
  approvedChangeOrdersToDate: number;
  revisedContractValue: number;
  estimateLineItemId: string | null;
  dateRequested: string | null;
  dateSubmitted: string | null;
  dateApproved: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Rfi = {
  id: string;
  projectId: string;
  projectName: string;
  rfiNumber: string;
  subject: string;
  question: string | null;
  submittedBy: string | null;
  assignedTo: string | null;
  discipline: CaDiscipline;
  priority: RfiPriority;
  status: RfiStatus;
  response: string | null;
  responseBy: string | null;
  dateSubmitted: string | null;
  dateRequired: string | null;
  dateResponded: string | null;
  linkedChangeOrderId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ManpowerRow = { trade: string; count: number; hours: number };

export type CaReport = {
  id: string;
  projectId: string;
  projectName: string;
  reportType: CaReportType;
  reportNumber: string;
  version: number;
  reportingPeriodStart: string | null;
  reportingPeriodEnd: string | null;
  preparedBy: string | null;
  reviewedBy: string | null;
  approvedBy: string | null;
  status: CaReportStatus;
  weatherSummary: string | null;
  siteConditions: string | null;
  workCompleted: string | null;
  workPlannedNextPeriod: string | null;
  manpowerSummary: ManpowerRow[];
  materialDeliveries: string | null;
  safetyIncidents: string | null;
  qualityIssues: string | null;
  delays: string | null;
  risks: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProgressCertification = {
  id: string;
  projectId: string;
  projectName: string;
  certificationNumber: string;
  version: number;
  inspectionDate: string | null;
  certifiedBy: string | null;
  lenderName: string | null;
  contractorName: string | null;
  contractValue: number;
  currency: string;
  previousPercentComplete: number;
  currentPercentComplete: number;
  workCompletedValue: number;
  retentionPercentage: number;
  retentionAmount: number;
  previousPaymentsValue: number;
  amountRecommendedForPayment: number;
  deficiencies: string | null;
  recommendation: string | null;
  status: CertificationStatus;
  createdAt: string;
  updatedAt: string;
};

export type PunchListItem = {
  id: string;
  projectId: string;
  projectName: string;
  itemNumber: string;
  location: string | null;
  description: string;
  trade: string | null;
  responsibleParty: string | null;
  priority: PunchPriority;
  status: PunchStatus;
  dateIdentified: string | null;
  dueDate: string | null;
  dateCompleted: string | null;
  verifiedBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SiteInstruction = {
  id: string;
  projectId: string;
  projectName: string;
  instructionNumber: string;
  title: string;
  description: string | null;
  issuedBy: string | null;
  issuedTo: string | null;
  discipline: CaDiscipline;
  costImpact: ImpactLevel;
  scheduleImpact: ImpactLevel;
  linkedChangeOrderId: string | null;
  status: SiteInstructionStatus;
  dateIssued: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Submittal = {
  id: string;
  projectId: string;
  projectName: string;
  submittalNumber: string;
  title: string;
  description: string | null;
  submittedBy: string | null;
  reviewedBy: string | null;
  discipline: CaDiscipline;
  status: SubmittalStatus;
  dateRequired: string | null;
  dateSubmitted: string | null;
  dateReviewed: string | null;
  reviewerComments: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DelayNotice = {
  id: string;
  projectId: string;
  projectName: string;
  delayNoticeNumber: string;
  title: string;
  description: string | null;
  cause: string | null;
  responsibleParty: string | null;
  claimedDays: number;
  approvedDays: number;
  costImpact: number;
  currency: string;
  status: DelayStatus;
  dateStarted: string | null;
  dateResolved: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Dashboard roll-up across the module for a project (or the whole portfolio). */
export type CaDashboard = {
  originalContractValue: number;
  approvedChangeOrders: number;
  pendingChangeOrders: number;
  revisedContractValue: number;
  percentComplete: number;
  scheduleStatusDays: number;
  openRfis: number;
  openSubmittals: number;
  openPunchItems: number;
  pendingBankDraws: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  currency: string;
};
