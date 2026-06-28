/**
 * Construction Administration — calculation utilities.
 *
 * Pure, side-effect-free, and unit-testable. These encode the exact formulas in
 * the module spec so the same numbers are produced in the form (live preview),
 * the API (persisted total), and the PDF (printed total).
 */

import type { ChangeOrderCosts } from "@/lib/ca/types";

const round2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
const pct = (p: number) => (Number.isFinite(p) ? p : 0) / 100;

export type ChangeOrderBreakdown = {
  subtotal: number;
  overhead: number;
  profit: number;
  contingency: number;
  vat: number;
  total: number;
};

/**
 * Change Order total — applied sequentially (each markup compounds on the
 * running total), per the spec:
 *   Subtotal     = labor + material + equipment + subcontractor
 *   Overhead     = Subtotal × overhead%
 *   Profit       = (Subtotal + Overhead) × profit%
 *   Contingency  = (Subtotal + Overhead + Profit) × contingency%
 *   VAT          = (Subtotal + Overhead + Profit + Contingency) × vat%
 *   Total        = Subtotal + Overhead + Profit + Contingency + VAT
 */
export function changeOrderBreakdown(c: ChangeOrderCosts): ChangeOrderBreakdown {
  const subtotal =
    (c.costLabor || 0) + (c.costMaterial || 0) + (c.costEquipment || 0) + (c.costSubcontractor || 0);
  const overhead = subtotal * pct(c.overheadPercentage);
  const profit = (subtotal + overhead) * pct(c.profitPercentage);
  const contingency = (subtotal + overhead + profit) * pct(c.contingencyPercentage);
  const vat = (subtotal + overhead + profit + contingency) * pct(c.vatPercentage);
  const total = subtotal + overhead + profit + contingency + vat;
  return {
    subtotal: round2(subtotal),
    overhead: round2(overhead),
    profit: round2(profit),
    contingency: round2(contingency),
    vat: round2(vat),
    total: round2(total),
  };
}

export function changeOrderTotal(c: ChangeOrderCosts): number {
  return changeOrderBreakdown(c).total;
}

/** Revised Contract Value = Original Contract Value + Approved Change Orders. */
export function revisedContractValue(original: number, approvedChangeOrdersToDate: number): number {
  return round2((original || 0) + (approvedChangeOrdersToDate || 0));
}

export type ProgressPaymentInput = {
  contractValue: number;
  currentPercentComplete: number; // 0–100
  retentionPercentage: number; // 0–100
  previousPaymentsValue: number;
};

export type ProgressPaymentResult = {
  workCompletedValue: number;
  retentionAmount: number;
  amountRecommendedForPayment: number;
};

/**
 * Progress / bank-draw payment, per the spec:
 *   Work Completed Value = Contract Value × Current % Complete
 *   Retention Amount     = Work Completed Value × Retention %
 *   Recommended Payment  = Work Completed Value − Retention − Previous Payments
 */
export function progressPayment(input: ProgressPaymentInput): ProgressPaymentResult {
  const workCompletedValue = (input.contractValue || 0) * pct(input.currentPercentComplete);
  const retentionAmount = workCompletedValue * pct(input.retentionPercentage);
  const amountRecommendedForPayment =
    workCompletedValue - retentionAmount - (input.previousPaymentsValue || 0);
  return {
    workCompletedValue: round2(workCompletedValue),
    retentionAmount: round2(retentionAmount),
    amountRecommendedForPayment: round2(amountRecommendedForPayment),
  };
}
