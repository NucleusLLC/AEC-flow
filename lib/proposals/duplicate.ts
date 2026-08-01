/**
 * Duplicating a Service Proposal — the pure rules.
 *
 * PURE (no Prisma, no session, no server-only imports) so the "what does a copy inherit"
 * decision is unit-tested on its own, and the data layer is left to do nothing but write
 * rows. Money is untouched here: the duplicate is rebuilt through `buildWriteData`, so every
 * figure on the copy still comes from `computeProposal` — never from the source's stored
 * totals.
 *
 * THE CENTRAL DECISION: a duplicate is a NEW DOCUMENT, not a revision.
 *
 * `reviseServiceProposal` already covers "the same offer, moved on a version" — it bumps
 * `revision` and supersedes the original. Duplicating is the other thing entirely: reuse this
 * proposal's content as the starting point for an unrelated offer. So a duplicate inherits the
 * *content* and nothing about the original's life as a commercial document:
 *
 *   - `status` → DRAFT, and `revision` → 1. The copy has never been anywhere.
 *   - `issuedAt` / `lockedAt` / `versionLabel` → null. Carrying `lockedAt` over would create a
 *     copy that the data layer refuses to edit the moment it exists; carrying `issuedAt` over
 *     would claim a document was sent to a client when it never was.
 *   - `deletedAt` → null. Duplicating a soft-deleted proposal yields a live one.
 *   - `preparedById` / `reviewedById` / `approvedById` / `ownerId` → null. These name people who
 *     vouched for the ORIGINAL's numbers. Inheriting them would forge an internal approval.
 *   - status history and version snapshots are NOT copied. Both are append-only audit records
 *     of things that happened to the original; replaying them onto the copy would fabricate
 *     history, and a version snapshot would let the copy print as a document the client
 *     "received".
 *   - attachments are NOT copied. `Attachment` rows point at one stored blob, so copying the
 *     rows would give two proposals a shared file that either can delete out from under the
 *     other. Re-attaching is a deliberate act.
 *
 * Everything else — title, client/project links, currency, cost basis and its worksheet, fee
 * components, phases, milestones, reimbursables, discounts, taxes, disciplines, scope,
 * narrative, terms, `validUntil` — IS carried over. That is the point of the feature, and it
 * matches what `reviseServiceProposal` already carries.
 */
import { nextProposalNumber } from "./persist";
import { INITIAL_VERSION } from "./versioning";

/** The inline message shown against the number input when the number is not free. */
export const NUMBER_IN_USE_MESSAGE = "That number is already used — choose a different one.";

/** Header columns deliberately reset on a duplicate. Documented for the test, and for anyone
 *  adding a column later who needs to decide which side of this line it falls on. */
export const DUPLICATE_RESET_FIELDS = [
  "number",
  "status",
  "revision",
  "versionLabel",
  "issuedAt",
  "lockedAt",
  "deletedAt",
  "preparedById",
  "reviewedById",
  "approvedById",
  "ownerId",
] as const;

/** Child collections copied onto the duplicate. */
export const DUPLICATE_COPIED_CHILDREN = [
  "disciplines",
  "phases",
  "feeComponents",
  "developmentCostItems",
  "paymentMilestones",
  "reimbursables",
  "discounts",
  "taxes",
] as const;

/** Child collections deliberately NOT copied — audit history and shared files. */
export const DUPLICATE_EXCLUDED_CHILDREN = ["statusHistory", "versions", "attachments"] as const;

export interface DuplicateResetData {
  status: "DRAFT";
  revision: 1;
  /** A copy is a brand-new draft, so it starts the version scheme over at 0.1. */
  versionLabel: typeof INITIAL_VERSION;
  issuedAt: null;
  lockedAt: null;
  deletedAt: null;
  preparedById: null;
  reviewedById: null;
  approvedById: null;
  ownerId: null;
}

/**
 * The header overrides that make a copy a fresh draft. Returned as data rather than applied
 * in the data layer so the rule is one testable value, not a scatter of literals in a
 * Prisma call.
 */
export function duplicateResetData(): DuplicateResetData {
  return {
    status: "DRAFT",
    revision: 1,
    versionLabel: INITIAL_VERSION,
    issuedAt: null,
    lockedAt: null,
    deletedAt: null,
    preparedById: null,
    reviewedById: null,
    approvedById: null,
    ownerId: null,
  };
}

/**
 * The number suggested for a duplicate: the next free one in the practice's sequence.
 *
 * This delegates to `nextProposalNumber` — the SAME helper `createServiceProposal` and
 * `reviseServiceProposal` use — rather than inventing a second scheme. That helper takes every
 * number the practice has ever used (soft-deleted included) and returns max + 1, so it answers
 * "the next free number", which is what a duplicate needs. It cannot answer "the number
 * immediately after SP-2026-001" — a sibling-of-the-source scheme like SP-2026-001-A is not
 * something it can express — and that is fine: the source proposal is irrelevant to a document
 * that is not a revision of it, and a per-source suffix would collide with the practice-wide
 * unique constraint on (companyId, number) the first time two people duplicated the same
 * proposal.
 */
export function suggestDuplicateNumber(
  existingNumbers: string[],
  year: number = new Date().getFullYear(),
): string {
  return nextProposalNumber(existingNumbers, year);
}

/** Trim a user-typed number; blank means "leave it to the sequence", expressed as null. */
export function normalizeProposalNumber(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Is this number already spoken for? Case-insensitive, because "sp-2026-001" and
 * "SP-2026-001" are the same number to a human even though Postgres's unique index would let
 * both through. Rejecting the near-miss up front is friendlier than letting two
 * indistinguishable numbers exist.
 */
export function isProposalNumberTaken(existingNumbers: string[], candidate: string): boolean {
  const needle = candidate.trim().toLowerCase();
  if (needle === "") return false;
  return existingNumbers.some((n) => n.trim().toLowerCase() === needle);
}

/**
 * The copy's title. "(copy)" is appended so the duplicate is distinguishable in the list the
 * instant it is created; duplicating a copy counts up rather than stacking suffixes. Editable
 * like any other field — this is a starting point, not a rule.
 */
export function duplicateTitle(title: string): string {
  const base = title.trim();
  const m = /^(.*?)\s*\(copy(?:\s+(\d+))?\)$/.exec(base);
  if (!m) return base === "" ? "(copy)" : `${base} (copy)`;
  const stem = m[1].trim();
  const n = m[2] ? Number(m[2]) : 1;
  return stem === "" ? `(copy ${n + 1})` : `${stem} (copy ${n + 1})`;
}
