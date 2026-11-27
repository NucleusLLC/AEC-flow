/**
 * Who may do the dangerous things — security audit D-6
 * (docs/SECURITY-AUDIT-2026-10-01.md, "Decisions for the owner").
 *
 * THE RULING (owner, 27 Nov 2026): "Director/Admin only".
 *
 *   1. Every action listed in `DIRECTOR_ADMIN_ACTIONS` may be taken ONLY by an
 *      ADMIN, a DIRECTOR or the founder — `canManagePractice`, which is the same
 *      set as `canManagePasswords` (lib/password-policy.ts) on purpose.
 *   2. A VIEWER is read-only everywhere (`canWrite`).
 *   3. Nobody approves their OWN leave — not even a Director (`checkLeaveWrite`).
 *
 * PURE + CLIENT-SAFE: no Prisma, no session. Server actions, route handlers and
 * the data layer call these to ENFORCE; screens call them only to decide what to
 * draw. Messages are plain English sentences shown as they are, like the other
 * refusals in this app (INVOICE_MANAGER_ONLY, FIRM_SETTINGS_FORBIDDEN).
 */
import { canManagePractice, isReadOnlyRole } from "@/lib/password-policy";

export type RoleActor = { role: string | null | undefined; isFounder: boolean };
export type IdentifiedActor = RoleActor & { id: string };

export type GatedAction =
  // Finance — invoices, payments, credit notes
  | "invoice.issue"
  | "invoice.send"
  | "invoice.recordPayment"
  | "invoice.void"
  | "invoice.reissue"
  | "invoice.reversePayment"
  | "invoice.deleteDraft"
  | "creditNote.issue"
  | "creditNote.void"
  // Construction contracts
  | "contract.issue"
  | "contract.void"
  | "contract.delete"
  | "contractTemplate.archive"
  // General Documents
  | "generalDocument.issue"
  | "generalDocument.void"
  | "generalDocument.supersede"
  | "generalDocument.delete"
  // Estimating — locks and the firm-wide libraries (each save is delete-all then recreate)
  | "estimate.lock"
  | "priceBook.replace"
  | "normSet.replace"
  | "generalConditions.replace"
  | "estimateTemplates.replace"
  | "wiki.replace"
  // Outbound email to any address through the platform sender
  | "email.send"
  // Proposal templates — change, delete, set the default
  | "proposalTemplate.manage"
  // Procurement
  | "purchaseOrder.delete"
  | "purchaseOrder.receive"
  // Construction administration
  | "changeOrder.decide"
  | "changeOrder.delete"
  | "certification.decide"
  // Land development — payments, invoices, contracts, sales contracts, reservations
  | "development.finance"
  // Team — add members, edit a colleague's record
  | "team.manage"
  // Leave — approve or reject (and never one's own: see checkLeaveWrite)
  | "leave.decide";

/** Every D-6 action. All of them are Director / Admin / founder only. */
export const DIRECTOR_ADMIN_ACTIONS: readonly GatedAction[] = [
  "invoice.issue",
  "invoice.send",
  "invoice.recordPayment",
  "invoice.void",
  "invoice.reissue",
  "invoice.reversePayment",
  "invoice.deleteDraft",
  "creditNote.issue",
  "creditNote.void",
  "contract.issue",
  "contract.void",
  "contract.delete",
  "contractTemplate.archive",
  "generalDocument.issue",
  "generalDocument.void",
  "generalDocument.supersede",
  "generalDocument.delete",
  "estimate.lock",
  "priceBook.replace",
  "normSet.replace",
  "generalConditions.replace",
  "estimateTemplates.replace",
  "wiki.replace",
  "email.send",
  "proposalTemplate.manage",
  "purchaseOrder.delete",
  "purchaseOrder.receive",
  "changeOrder.decide",
  "changeOrder.delete",
  "certification.decide",
  "development.finance",
  "team.manage",
  "leave.decide",
];

export const DIRECTOR_ADMIN_ONLY = "Only an administrator or director can do this.";
export const READ_ONLY_REFUSAL = "Your role is view-only, so you cannot make changes.";
export const OWN_LEAVE_REFUSAL = "You cannot approve or reject your own leave. Ask another director or administrator.";

/** Thin alias, the clearer name for the finance doors. Same set as canManagePasswords. */
export function canApproveFinance(role: string | null | undefined, isFounder: boolean): boolean {
  return canManagePractice(role, isFounder);
}

/** May this actor write at all? Everyone except a VIEWER (the founder always may). */
export function canWrite(actor: RoleActor): boolean {
  return !isReadOnlyRole(actor.role, actor.isFounder);
}

/** May this actor take this D-6 action? */
export function canDo(action: GatedAction, actor: RoleActor): boolean {
  if (!DIRECTOR_ADMIN_ACTIONS.includes(action)) return canWrite(actor);
  return canManagePractice(actor.role, actor.isFounder);
}

/** The refusal sentence, or null when the actor may proceed. */
export function deniedFor(action: GatedAction | "write", actor: RoleActor): string | null {
  if (!canWrite(actor)) return READ_ONLY_REFUSAL;
  if (action === "write") return null;
  return canDo(action, actor) ? null : DIRECTOR_ADMIN_ONLY;
}

/* ------------------------------------------------------------------ */
/* Leave                                                               */
/* ------------------------------------------------------------------ */

/** A decided request: someone approved or rejected it. */
export const DECIDED_LEAVE_STATUSES = ["APPROVED", "REJECTED"] as const;

export type LeaveSnapshot = {
  userId: string;
  status: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
};

function isDecidedLeave(status: string | null | undefined): boolean {
  return (DECIDED_LEAVE_STATUSES as readonly string[]).includes(status ?? "");
}

/** The fields whose change on a decided request amounts to deciding it again. */
function leaveTermsChanged(before: LeaveSnapshot, after: LeaveSnapshot): boolean {
  return (
    before.userId !== after.userId ||
    before.type !== after.type ||
    before.startDate !== after.startDate ||
    before.endDate !== after.endDate ||
    before.days !== after.days
  );
}

/**
 * Is this write a DECISION on leave — approving or rejecting it, or changing the
 * terms of a request that is already decided (extending approved leave is
 * approving the extra days)? `before` is null for a new request.
 */
export function isLeaveDecision(before: LeaveSnapshot | null, after: LeaveSnapshot): boolean {
  if (before === null) return isDecidedLeave(after.status);
  if (after.status !== before.status) return isDecidedLeave(after.status) || isDecidedLeave(before.status);
  return isDecidedLeave(after.status) && leaveTermsChanged(before, after);
}

/**
 * May `actor` make this leave write?
 *  - a VIEWER may not write leave at all;
 *  - filing, editing and cancelling an undecided request is open to members;
 *  - a decision is Director / Admin / founder only;
 *  - and never on one's own request — not even a Director. Both the request's
 *    owner before and after the write count, so a request cannot be moved to
 *    someone else, approved, and moved back.
 */
export function checkLeaveWrite(
  actor: IdentifiedActor,
  before: LeaveSnapshot | null,
  after: LeaveSnapshot,
): { ok: true } | { ok: false; error: string } {
  if (!canWrite(actor)) return { ok: false, error: READ_ONLY_REFUSAL };
  if (!isLeaveDecision(before, after)) return { ok: true };
  if (!canDo("leave.decide", actor)) return { ok: false, error: DIRECTOR_ADMIN_ONLY };
  if (after.userId === actor.id || before?.userId === actor.id) return { ok: false, error: OWN_LEAVE_REFUSAL };
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Construction administration                                         */
/* ------------------------------------------------------------------ */

/** Change-order statuses that are a decision on it. */
export const DECIDED_CHANGE_ORDER_STATUSES = ["APPROVED", "REJECTED", "VOID"] as const;

/**
 * Does this change-order write need a director? Moving it into or out of a
 * decided status does, and so does any edit of a decided one (an approved
 * change order is money owed). `before` is null on create; `next` undefined
 * means the status is left as it is.
 */
export function changeOrderWriteIsDecision(before: string | null, next: string | null | undefined): boolean {
  const decided = DECIDED_CHANGE_ORDER_STATUSES as readonly string[];
  const after = next ?? before ?? "DRAFT";
  return decided.includes(after) || (before !== null && decided.includes(before));
}

/** Certification statuses that certify money: issuing it and approving it. */
export const DECIDED_CERTIFICATION_STATUSES = ["ISSUED", "APPROVED"] as const;

/** Same shape as change orders: into, out of, or an edit of an issued / approved certification. */
export function certificationWriteIsDecision(before: string | null, next: string | null | undefined): boolean {
  const decided = DECIDED_CERTIFICATION_STATUSES as readonly string[];
  const after = next ?? before ?? "DRAFT";
  return decided.includes(after) || (before !== null && decided.includes(before));
}

/* ------------------------------------------------------------------ */
/* Land development                                                    */
/* ------------------------------------------------------------------ */

/** The development sub-resources that are money or a legal commitment (D-6). */
export const DEVELOPMENT_FINANCE_RESOURCES = [
  "payments",
  "invoices",
  "contracts",
  "sales-contracts",
  "reservations",
] as const;

export function developmentResourceAction(resource: string): GatedAction | "write" {
  return (DEVELOPMENT_FINANCE_RESOURCES as readonly string[]).includes(resource) ? "development.finance" : "write";
}

/* ------------------------------------------------------------------ */
/* The database backstop                                               */
/* ------------------------------------------------------------------ */

export type WriteContext = {
  /** The signed-in user's role from their DATABASE row; null when nobody is signed in. */
  role: string | null;
  isFounder: boolean;
  /** True inside a server action (a `next-action` request) — the only place the backstop acts. */
  inServerAction: boolean;
  /** True when the caller proved the company it acts for without a session (runAsCompany, /p, /pay). */
  explicitCompany: boolean;
};

/**
 * Should the Prisma tenant extension refuse this write? Only a signed-in VIEWER
 * writing from a server action. Page renders (GET) are left alone on purpose: a
 * read that happens to stamp something (a receipt number) must not crash a
 * VIEWER's page. Session-less callers that proved their company (Stripe webhook,
 * public acceptance link) act for the practice, not for a user, and pass.
 */
export function readOnlyWriteRefusal(ctx: WriteContext): string | null {
  if (!ctx.inServerAction || ctx.explicitCompany || ctx.role === null) return null;
  return isReadOnlyRole(ctx.role, ctx.isFounder) ? READ_ONLY_REFUSAL : null;
}
