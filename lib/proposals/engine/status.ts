/**
 * Service Proposal status workflow.
 *
 * Transitions are explicit so audit history stays coherent — a proposal cannot jump from
 * Draft straight to Accepted, because that would imply a client accepted something that was
 * never issued.
 *
 * SCOPE NOTE: the specification lists 17 statuses. Two of them — Delivered and Viewed —
 * require email delivery webhooks and open-tracking that this stack does not have, and
 * open-tracking is unreliable and carries privacy implications. Modelling a status nothing
 * can ever set produces a workflow that silently stalls, so they are omitted until real
 * webhook support exists. See docs/proposal-module/03-CRITICAL-REVIEW.md §C2.
 *
 * PURE — no I/O.
 */

export type ServiceProposalStatus =
  | "DRAFT"
  | "INTERNAL_REVIEW"
  | "APPROVED_FOR_ISSUE"
  | "SENT"
  | "UNDER_CLIENT_REVIEW"
  | "REVISION_REQUESTED"
  | "REVISED"
  | "ACCEPTED"
  | "PARTIALLY_ACCEPTED"
  | "REJECTED"
  | "EXPIRED"
  | "WITHDRAWN"
  | "SUPERSEDED"
  | "CONVERTED";

export const STATUS_LABEL: Record<ServiceProposalStatus, string> = {
  DRAFT: "Draft",
  INTERNAL_REVIEW: "Internal review",
  APPROVED_FOR_ISSUE: "Approved for issue",
  SENT: "Sent",
  UNDER_CLIENT_REVIEW: "Under client review",
  REVISION_REQUESTED: "Revision requested",
  REVISED: "Revised",
  ACCEPTED: "Accepted",
  PARTIALLY_ACCEPTED: "Partially accepted",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  WITHDRAWN: "Withdrawn",
  SUPERSEDED: "Superseded",
  CONVERTED: "Converted to project",
};

/** Statuses still in play — counted as open pipeline. */
export const OPEN_STATUSES: ServiceProposalStatus[] = [
  "DRAFT",
  "INTERNAL_REVIEW",
  "APPROVED_FOR_ISSUE",
  "SENT",
  "UNDER_CLIENT_REVIEW",
  "REVISION_REQUESTED",
  "REVISED",
];

/** Statuses where the proposal has been issued to the client and must not be edited. */
export const ISSUED_STATUSES: ServiceProposalStatus[] = [
  "SENT",
  "UNDER_CLIENT_REVIEW",
  "REVISION_REQUESTED",
  "ACCEPTED",
  "PARTIALLY_ACCEPTED",
  "REJECTED",
  "EXPIRED",
  "SUPERSEDED",
  "CONVERTED",
];

/** Statuses that lock the record against content changes entirely. */
export const LOCKED_STATUSES: ServiceProposalStatus[] = [
  "ACCEPTED",
  "PARTIALLY_ACCEPTED",
  "CONVERTED",
  "SUPERSEDED",
];

const TRANSITIONS: Record<ServiceProposalStatus, ServiceProposalStatus[]> = {
  DRAFT: ["INTERNAL_REVIEW", "APPROVED_FOR_ISSUE", "WITHDRAWN"],
  INTERNAL_REVIEW: ["APPROVED_FOR_ISSUE", "DRAFT", "WITHDRAWN"],
  APPROVED_FOR_ISSUE: ["SENT", "DRAFT", "WITHDRAWN"],
  SENT: [
    "UNDER_CLIENT_REVIEW",
    "ACCEPTED",
    "PARTIALLY_ACCEPTED",
    "REJECTED",
    "REVISION_REQUESTED",
    "EXPIRED",
    "WITHDRAWN",
    "SUPERSEDED",
  ],
  UNDER_CLIENT_REVIEW: [
    "ACCEPTED",
    "PARTIALLY_ACCEPTED",
    "REJECTED",
    "REVISION_REQUESTED",
    "EXPIRED",
    "WITHDRAWN",
  ],
  REVISION_REQUESTED: ["REVISED", "WITHDRAWN", "SUPERSEDED"],
  REVISED: ["SENT", "INTERNAL_REVIEW", "APPROVED_FOR_ISSUE", "WITHDRAWN"],
  ACCEPTED: ["CONVERTED", "SUPERSEDED"],
  PARTIALLY_ACCEPTED: ["ACCEPTED", "CONVERTED", "SUPERSEDED"],
  REJECTED: ["SUPERSEDED"],
  EXPIRED: ["REVISED", "SUPERSEDED", "WITHDRAWN"],
  WITHDRAWN: [],
  SUPERSEDED: [],
  CONVERTED: [],
};

export function allowedTransitions(from: ServiceProposalStatus): ServiceProposalStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function canTransition(
  from: ServiceProposalStatus,
  to: ServiceProposalStatus,
): boolean {
  return allowedTransitions(from).includes(to);
}

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: ServiceProposalStatus,
    readonly to: ServiceProposalStatus,
  ) {
    super(`Cannot move a proposal from "${STATUS_LABEL[from]}" to "${STATUS_LABEL[to]}".`);
    this.name = "InvalidTransitionError";
  }
}

/** Throwing guard for the service layer — the UI uses `canTransition` to hide controls. */
export function assertTransition(
  from: ServiceProposalStatus,
  to: ServiceProposalStatus,
): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

export function isLocked(status: ServiceProposalStatus): boolean {
  return LOCKED_STATUSES.includes(status);
}

export function isIssued(status: ServiceProposalStatus): boolean {
  return ISSUED_STATUSES.includes(status);
}

export function isOpen(status: ServiceProposalStatus): boolean {
  return OPEN_STATUSES.includes(status);
}
