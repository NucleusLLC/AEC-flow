/**
 * Construction Administration — status/enum display labels and badge tones.
 * Shared by client views, server detail pages and print pages so a status looks
 * identical everywhere.
 */
import type {
  ChangeOrderStatus,
  CaReportStatus,
  CaReportType,
  CaDiscipline,
  RfiPriority,
  RfiStatus,
  CertificationStatus,
  PunchStatus,
  SiteInstructionStatus,
  SubmittalStatus,
  DelayStatus,
  ImpactLevel,
} from "@/lib/ca/types";

export type Tone = "neutral" | "blue" | "green" | "amber" | "red" | "violet" | "slate";

export const CHANGE_ORDER_STATUS_LABEL: Record<ChangeOrderStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  VOID: "Void",
};
export const CHANGE_ORDER_STATUS_TONE: Record<ChangeOrderStatus, Tone> = {
  DRAFT: "neutral",
  SUBMITTED: "blue",
  UNDER_REVIEW: "amber",
  APPROVED: "green",
  REJECTED: "red",
  VOID: "slate",
};

export const RFI_STATUS_LABEL: Record<RfiStatus, string> = {
  OPEN: "Open",
  ANSWERED: "Answered",
  CLOSED: "Closed",
  VOID: "Void",
};
export const RFI_STATUS_TONE: Record<RfiStatus, Tone> = {
  OPEN: "amber",
  ANSWERED: "blue",
  CLOSED: "green",
  VOID: "slate",
};

export const RFI_PRIORITY_LABEL: Record<RfiPriority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};
export const RFI_PRIORITY_TONE: Record<RfiPriority, Tone> = {
  LOW: "slate",
  NORMAL: "blue",
  HIGH: "amber",
  URGENT: "red",
};

export const CA_REPORT_TYPE_LABEL: Record<CaReportType, string> = {
  DAILY: "Daily Report",
  WEEKLY: "Weekly Report",
  BIWEEKLY: "Bi-Weekly Report",
  MONTHLY: "Monthly Report",
  EXECUTIVE: "Executive Report",
  PROGRESS_CERTIFICATION: "Progress Certification",
  BANK_DRAW: "Bank Draw Request",
  COMPLETION: "Completion Report",
};

export const CA_REPORT_STATUS_LABEL: Record<CaReportStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  REVIEWED: "Reviewed",
  APPROVED: "Approved",
  ISSUED: "Issued",
  ARCHIVED: "Archived",
};
export const CA_REPORT_STATUS_TONE: Record<CaReportStatus, Tone> = {
  DRAFT: "neutral",
  SUBMITTED: "blue",
  REVIEWED: "violet",
  APPROVED: "green",
  ISSUED: "green",
  ARCHIVED: "slate",
};

export const CERT_STATUS_LABEL: Record<CertificationStatus, string> = {
  DRAFT: "Draft",
  ISSUED: "Issued",
  APPROVED: "Approved",
  ARCHIVED: "Archived",
};
export const CERT_STATUS_TONE: Record<CertificationStatus, Tone> = {
  DRAFT: "neutral",
  ISSUED: "blue",
  APPROVED: "green",
  ARCHIVED: "slate",
};

export const PUNCH_STATUS_LABEL: Record<PunchStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
};
export const PUNCH_STATUS_TONE: Record<PunchStatus, Tone> = {
  OPEN: "amber",
  IN_PROGRESS: "blue",
  COMPLETED: "violet",
  VERIFIED: "green",
  REJECTED: "red",
};

export const SITE_INSTRUCTION_STATUS_LABEL: Record<SiteInstructionStatus, string> = {
  DRAFT: "Draft",
  ISSUED: "Issued",
  ACKNOWLEDGED: "Acknowledged",
  CLOSED: "Closed",
};
export const SITE_INSTRUCTION_STATUS_TONE: Record<SiteInstructionStatus, Tone> = {
  DRAFT: "neutral",
  ISSUED: "blue",
  ACKNOWLEDGED: "amber",
  CLOSED: "green",
};

export const SUBMITTAL_STATUS_LABEL: Record<SubmittalStatus, string> = {
  REQUIRED: "Required",
  SUBMITTED: "Submitted",
  REVIEWED: "Reviewed",
  APPROVED: "Approved",
  APPROVED_AS_NOTED: "Approved as noted",
  REVISE_AND_RESUBMIT: "Revise & resubmit",
  REJECTED: "Rejected",
};
export const SUBMITTAL_STATUS_TONE: Record<SubmittalStatus, Tone> = {
  REQUIRED: "neutral",
  SUBMITTED: "blue",
  REVIEWED: "violet",
  APPROVED: "green",
  APPROVED_AS_NOTED: "green",
  REVISE_AND_RESUBMIT: "amber",
  REJECTED: "red",
};

export const DELAY_STATUS_LABEL: Record<DelayStatus, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  CLOSED: "Closed",
};
export const DELAY_STATUS_TONE: Record<DelayStatus, Tone> = {
  SUBMITTED: "blue",
  UNDER_REVIEW: "amber",
  ACCEPTED: "green",
  REJECTED: "red",
  CLOSED: "slate",
};

export const IMPACT_LEVEL_LABEL: Record<ImpactLevel, string> = {
  NONE: "None",
  POSSIBLE: "Possible",
  CONFIRMED: "Confirmed",
};
export const IMPACT_LEVEL_TONE: Record<ImpactLevel, Tone> = {
  NONE: "slate",
  POSSIBLE: "amber",
  CONFIRMED: "red",
};

export const DISCIPLINE_LABEL: Record<CaDiscipline, string> = {
  ARCHITECTURAL: "Architectural",
  STRUCTURAL: "Structural",
  MECHANICAL: "Mechanical",
  ELECTRICAL: "Electrical",
  PLUMBING: "Plumbing",
  CIVIL: "Civil",
  OTHER: "Other",
};
