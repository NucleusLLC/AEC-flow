/**
 * Service Proposal approval thresholds — the pure policy.
 *
 * THE RULING (owner, 27 Nov 2026): "Discount OR fee".
 *
 *   A proposal needs a Director's approval before it can be sent to the client when
 *   EITHER its discount exceeds a percentage of the subtotal (default 10%) OR its total
 *   fee exceeds an amount (default 50,000 AWG). Both limits are per practice
 *   (Settings > Proposal Templates > Proposal approval). Below both limits nothing
 *   changes: anyone who may issue a proposal still may.
 *
 *   Who approves: ADMIN, DIRECTOR or the founder — `canManagePractice`, the D-6 set
 *   (lib/permissions/role-gates.ts). A Director MAY approve a proposal they prepared
 *   themselves: the practice owner is often the only Director. STAFF and MANAGER may not.
 *
 *   Approving records who (ServiceProposal.approvedById) and when (the status-history
 *   row the approval writes). Any edit that changes the fee or the discount clears it.
 *
 * WHAT IS COMPARED
 *   - Discount: `discountTotal / subtotal`, the subtotal being the figure the discount is
 *     taken off (lib/proposals/engine/engine.ts). Compared on the engine's integer minor
 *     units by cross-multiplication, so no second rounding is introduced.
 *   - Fee: `grandTotal`, the amount the client is asked to pay — the headline figure on
 *     the document. The practice quotes tax-inclusive, so this is the fee.
 *   - "Exceeds" is strict: exactly 10% or exactly 50,000.00 does not need approval.
 *
 * CURRENCY
 *   The fee limit is stored with the currency it was set in. A proposal in another
 *   currency is compared after converting the LIMIT with the app's existing rate table
 *   (`USD_RATE_BY_CURRENCY`, lib/data/estimates.types.ts: USD, the pegged AWG/ANG at
 *   1.79, and EUR at its fixed default). When either currency is not in that table the
 *   fee rule is NOT applied — only the discount rule is — and the check says so
 *   (`feeCompared: false`), so the screen can tell the user rather than imply a pass.
 *
 * PURE + CLIENT-SAFE: no Prisma, no session.
 */
import { compare, fromMajor, type Money } from "./engine/money";
import { canTransition, type ServiceProposalStatus } from "./engine/status";
import { USD_RATE_BY_CURRENCY } from "@/lib/data/estimates.types";
import { canManagePractice } from "@/lib/password-policy";

export type ApprovalThresholds = {
  /** Discount above this percentage of the subtotal needs approval. */
  maxDiscountPercent: number;
  /** A total fee above this amount (in `currency`) needs approval. */
  maxFee: number;
  /** ISO code the fee limit is expressed in. */
  currency: string;
};

export const DEFAULT_MAX_DISCOUNT_PERCENT = 10;
export const DEFAULT_MAX_FEE = 50_000;
export const DEFAULT_THRESHOLD_CURRENCY = "AWG";
/** Ceiling on the fee limit so a typo cannot store an absurd number. */
export const MAX_FEE_LIMIT = 1_000_000_000;

export const DEFAULT_APPROVAL_THRESHOLDS: ApprovalThresholds = {
  maxDiscountPercent: DEFAULT_MAX_DISCOUNT_PERCENT,
  maxFee: DEFAULT_MAX_FEE,
  currency: DEFAULT_THRESHOLD_CURRENCY,
};

function finite(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * Whatever is stored (or typed), clamped into a usable set of limits. Missing or bad
 * values fall back to the defaults; `fallbackCurrency` (the practice's system currency)
 * is used when no currency was stored with the limit.
 */
export function parseApprovalThresholds(
  raw: unknown,
  fallbackCurrency: string = DEFAULT_THRESHOLD_CURRENCY,
): ApprovalThresholds {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pct = finite(o.maxDiscountPercent);
  const fee = finite(o.maxFee);
  const cur = typeof o.currency === "string" && /^[A-Za-z]{3}$/.test(o.currency.trim())
    ? o.currency.trim().toUpperCase()
    : (fallbackCurrency || DEFAULT_THRESHOLD_CURRENCY).toUpperCase();
  return {
    maxDiscountPercent:
      pct === null ? DEFAULT_MAX_DISCOUNT_PERCENT : Math.round(Math.min(100, Math.max(0, pct)) * 100) / 100,
    maxFee: fee === null ? DEFAULT_MAX_FEE : Math.round(Math.min(MAX_FEE_LIMIT, Math.max(0, fee)) * 100) / 100,
    currency: cur,
  };
}

/** The stored figures the rules read — the engine's own totals, as persisted. */
export type ApprovalFigures = {
  currency: string;
  subtotal: number;
  discountTotal: number;
  grandTotal: number;
};

export type TrippedRule =
  | { rule: "discount"; percent: number; limit: number }
  | { rule: "fee"; amount: number; currency: string; limit: number; limitCurrency: string };

export type ApprovalCheck = {
  /** True when at least one rule is exceeded. */
  required: boolean;
  tripped: TrippedRule[];
  /** False when the fee rule could not be applied (no rate between the two currencies). */
  feeCompared: boolean;
};

/**
 * The fee limit expressed in `currency`, or null when there is no rate to convert with.
 * Converted once, through `fromMajor` — the single rounding point money.ts defines.
 */
export function feeLimitIn(currency: string, thr: ApprovalThresholds): Money | null {
  const to = currency.toUpperCase();
  const from = thr.currency.toUpperCase();
  if (to === from) return fromMajor(thr.maxFee, to);
  const usdPerFrom = USD_RATE_BY_CURRENCY[from];
  const usdPerTo = USD_RATE_BY_CURRENCY[to];
  if (!usdPerFrom || !usdPerTo) return null;
  return fromMajor((thr.maxFee * usdPerFrom) / usdPerTo, to);
}

/** Discount as a percentage of the subtotal, one decimal, for display. */
export function discountPercent(fig: ApprovalFigures): number {
  const sub = fromMajor(fig.subtotal, fig.currency).minor;
  const disc = fromMajor(fig.discountTotal, fig.currency).minor;
  if (sub <= 0 || disc <= 0) return 0;
  return Math.round((disc * 1000) / sub) / 10;
}

/** Which rules does this proposal exceed? */
export function checkApproval(fig: ApprovalFigures, thr: ApprovalThresholds): ApprovalCheck {
  const tripped: TrippedRule[] = [];

  const sub = fromMajor(fig.subtotal, fig.currency).minor;
  const disc = fromMajor(fig.discountTotal, fig.currency).minor;
  // disc / sub > limit / 100  <=>  disc * 100 > limit * sub  (sub > 0). Integers on the left.
  if (disc > 0 && sub > 0 && disc * 100 > thr.maxDiscountPercent * sub) {
    tripped.push({ rule: "discount", percent: discountPercent(fig), limit: thr.maxDiscountPercent });
  } else if (disc > 0 && sub <= 0) {
    // A discount on nothing is a discount of more than any limit.
    tripped.push({ rule: "discount", percent: 100, limit: thr.maxDiscountPercent });
  }

  const limit = feeLimitIn(fig.currency, thr);
  const fee = fromMajor(fig.grandTotal, fig.currency);
  if (limit && compare(fee, limit) > 0) {
    tripped.push({
      rule: "fee",
      amount: fig.grandTotal,
      currency: fig.currency,
      limit: thr.maxFee,
      limitCurrency: thr.currency,
    });
  }

  return { required: tripped.length > 0, tripped, feeCompared: limit !== null };
}

/** May this actor approve a proposal for sending? ADMIN / DIRECTOR / founder. */
export function canApproveProposals(role: string | null | undefined, isFounder: boolean): boolean {
  return canManagePractice(role, isFounder);
}

/**
 * Has the fee or the discount changed between two sets of figures? Any change clears an
 * approval: the Director approved THOSE numbers. Compared in minor units so a float
 * round-trip through the database is not mistaken for an edit.
 */
export function figuresChanged(before: ApprovalFigures, after: ApprovalFigures): boolean {
  if (before.currency.toUpperCase() !== after.currency.toUpperCase()) return true;
  const c = after.currency;
  const same = (a: number, b: number) => fromMajor(a, c).minor === fromMajor(b, c).minor;
  return !(
    same(before.subtotal, after.subtotal) &&
    same(before.discountTotal, after.discountTotal) &&
    same(before.grandTotal, after.grandTotal)
  );
}

/** Statuses from which the proposal has still to be sent — where an approval matters. */
export function isBeforeSending(status: ServiceProposalStatus): boolean {
  return canTransition(status, "SENT") || canTransition(status, "APPROVED_FOR_ISSUE");
}

/**
 * Is this proposal waiting for a Director? Over a limit, not approved, and not yet sent.
 * `approvedById` is the stored approval; it is cleared by any fee/discount edit.
 */
export function isAwaitingApproval(
  status: ServiceProposalStatus,
  check: ApprovalCheck,
  approvedById: string | null | undefined,
): boolean {
  return isBeforeSending(status) && check.required && !approvedById;
}

export const APPROVAL_REQUIRED_REFUSAL =
  "This proposal needs a Director's approval before it can be sent to the client.";
export const APPROVER_ONLY_REFUSAL =
  "Only a Director or an administrator can approve a proposal for sending.";

/**
 * May the proposal be sent now? The refusal sentence, or null. Role-independent: once a
 * Director has approved, whoever may issue may send it.
 */
export function sendRefusal(check: ApprovalCheck, approvedById: string | null | undefined): string | null {
  return check.required && !approvedById ? APPROVAL_REQUIRED_REFUSAL : null;
}

/** Plain-English reasons for the history row and the server refusal, e.g. "discount 15% > 10%". */
export function describeTripped(tripped: TrippedRule[], formatMoney: (n: number, currency: string) => string): string {
  return tripped
    .map((r) =>
      r.rule === "discount"
        ? `discount ${r.percent}% > ${r.limit}%`
        : `fee ${formatMoney(r.amount, r.currency)} > ${formatMoney(r.limit, r.limitCurrency)}`,
    )
    .join("; ");
}
