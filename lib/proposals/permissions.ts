/**
 * Service Proposal permissions.
 *
 * There is no general authorization layer in this application yet, so rather than retrofit
 * one across the whole app, this module introduces a scoped, explicit permission map for
 * proposals only. It is CLIENT-SAFE (no Prisma) so the same `can()` drives both server-side
 * enforcement (authoritative) and UI control visibility.
 *
 * POLICY (decision 2026-07-24, 03-CRITICAL-REVIEW.md §A3): permissive by default. Beta
 * testers self-register as STAFF; gating creation behind higher roles would lock them out of
 * the module on day one. So STAFF gets the full day-to-day workflow, and only the genuinely
 * privileged actions — approving, converting to a project, and configuring firm-wide
 * templates/rates — are held back.
 *
 * Enforcement lives in every server action (backend is authoritative). The UI uses the same
 * function to hide controls, but hiding a control is never the security boundary.
 */
import type { UserRole } from "@prisma/client";
import { isLocked, type ServiceProposalStatus } from "./engine/status";

export type ProposalAction =
  | "view"
  | "create"
  | "edit"
  | "editFees"
  | "delete"
  | "issue"
  | "approve"
  | "accept"
  | "convert"
  | "configure";

/**
 * Role → allowed actions. Ordered least to most privileged. A higher role is a superset of
 * the ones below it, but the map is written out in full rather than layered so the exact
 * grant for each role is readable at a glance.
 */
const ROLE_ACTIONS: Record<UserRole, ReadonlySet<ProposalAction>> = {
  VIEWER: new Set<ProposalAction>(["view"]),
  // The beta default. Full day-to-day authoring; not approval, conversion or configuration.
  STAFF: new Set<ProposalAction>(["view", "create", "edit", "editFees", "delete", "issue", "accept"]),
  MANAGER: new Set<ProposalAction>([
    "view",
    "create",
    "edit",
    "editFees",
    "delete",
    "issue",
    "accept",
    "convert",
  ]),
  DIRECTOR: new Set<ProposalAction>([
    "view",
    "create",
    "edit",
    "editFees",
    "delete",
    "issue",
    "approve",
    "accept",
    "convert",
    "configure",
  ]),
  ADMIN: new Set<ProposalAction>([
    "view",
    "create",
    "edit",
    "editFees",
    "delete",
    "issue",
    "approve",
    "accept",
    "convert",
    "configure",
  ]),
};

/** The actor as far as authorization is concerned. */
export interface ProposalActor {
  role: UserRole;
  userId?: string | null;
}

/** Minimal proposal shape needed for a permission decision. */
export interface ProposalSubject {
  status: ServiceProposalStatus;
  ownerId?: string | null;
  createdById?: string | null;
}

/**
 * May this actor take this action (optionally on this specific proposal)?
 *
 * Beyond the role grant, two status-driven rules apply regardless of role:
 *   - a LOCKED proposal (accepted / converted / superseded) cannot be edited at all;
 *   - a locked proposal cannot be deleted (it is a commercial record).
 * These mirror the data-layer guards so the UI and the server agree.
 */
export function can(
  actor: ProposalActor,
  action: ProposalAction,
  subject?: ProposalSubject,
): boolean {
  if (!ROLE_ACTIONS[actor.role]?.has(action)) return false;

  if (subject) {
    const locked = isLocked(subject.status);
    if (locked && (action === "edit" || action === "editFees" || action === "delete")) {
      return false;
    }
  }

  return true;
}

/** Throwing guard for server actions. */
export class ProposalPermissionError extends Error {
  constructor(action: ProposalAction) {
    super(`You do not have permission to ${action} this proposal.`);
    this.name = "ProposalPermissionError";
  }
}

export function assertCan(
  actor: ProposalActor,
  action: ProposalAction,
  subject?: ProposalSubject,
): void {
  if (!can(actor, action, subject)) throw new ProposalPermissionError(action);
}

/** Convenience for the UI: the full set this actor could ever do, ignoring subject state. */
export function allowedActions(role: UserRole): ProposalAction[] {
  return [...(ROLE_ACTIONS[role] ?? new Set())];
}
