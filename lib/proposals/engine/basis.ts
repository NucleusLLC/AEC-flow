/**
 * Cost-basis resolution for percentage fees.
 *
 * Two things make this more than a multiplication:
 *
 * 1. THE BASIS MUST BE NAMED. A 7% fee on estimated construction cost and a 7% fee on total
 *    development cost are very different numbers on a land-heavy project. The basis type and
 *    amount travel with the result so the document can always state them.
 *
 * 2. TOTAL DEVELOPMENT COST IS CIRCULAR. A development-cost worksheet normally contains a
 *    "professional fees" line — which includes this very proposal's fee. Applying a
 *    percentage to a basis that contains its own output is circular. This module detects it
 *    and resolves it one of two documented ways, never silently.
 *
 * PURE — no I/O. See docs/proposal-module/02-TECHNICAL-ARCHITECTURE.md §3.
 */
import { fromMajor, toMajor, zero, type Money } from "./money";
import {
  COST_BASIS_LABEL,
  type BasisResult,
  type CostBasisInput,
  type Diagnostic,
  type DevelopmentCostItem,
} from "./types";

export interface ResolvedBasis {
  /** Null when no basis was supplied — percentage components then raise an error. */
  basis: BasisResult | null;
  amount: Money;
  warnings: Diagnostic[];
  errors: Diagnostic[];
}

/** Sum of worksheet lines flagged as included in the basis. */
export function worksheetTotal(items: DevelopmentCostItem[], currency: string): Money {
  return items
    .filter((i) => i.includedInBasis)
    .reduce<Money>((acc, i) => {
      const v = fromMajor(i.amount, currency);
      return { minor: acc.minor + v.minor, currency };
    }, zero(currency));
}

/** The professional-fees portion of the included worksheet lines. */
export function professionalFeesInBasis(
  items: DevelopmentCostItem[],
  currency: string,
): Money {
  return items
    .filter((i) => i.includedInBasis && i.isProfessionalFees)
    .reduce<Money>((acc, i) => {
      const v = fromMajor(i.amount, currency);
      return { minor: acc.minor + v.minor, currency };
    }, zero(currency));
}

/**
 * Resolve the amount a percentage fee applies to.
 *
 * For TOTAL_DEVELOPMENT_COST with a worksheet, the basis is the sum of included categories.
 * When that sum contains a professional-fees line, circularity is resolved by:
 *
 *   EXCLUDE_OWN_FEE (default) — remove the professional-fees line from the basis. Simple,
 *     conservative, and easy to explain to a client.
 *   GROSS_UP — keep the full basis and let the caller apply fee = (base x r) / (1 - r),
 *     which is the mathematically correct closed form when the fee genuinely forms part of
 *     the development cost. Requires r < 1; `grossUpFactor` enforces that.
 *
 * Either way a warning names the method used. The spec's requirement is not that one is
 * chosen, but that the choice is explicit and documented.
 */
export function resolveCostBasis(
  input: CostBasisInput | null | undefined,
  currency: string,
): ResolvedBasis {
  const warnings: Diagnostic[] = [];
  const errors: Diagnostic[] = [];

  if (!input) {
    return { basis: null, amount: zero(currency), warnings, errors };
  }

  const handling = input.circularHandling ?? "EXCLUDE_OWN_FEE";
  let amount: Money;
  let circularHandling: BasisResult["circularHandling"] = null;

  const hasWorksheet = Array.isArray(input.worksheet) && input.worksheet.length > 0;

  if (input.type === "TOTAL_DEVELOPMENT_COST" && hasWorksheet) {
    const worksheet = input.worksheet as DevelopmentCostItem[];
    const gross = worksheetTotal(worksheet, currency);
    const fees = professionalFeesInBasis(worksheet, currency);

    if (fees.minor > 0) {
      circularHandling = handling;
      if (handling === "EXCLUDE_OWN_FEE") {
        amount = { minor: gross.minor - fees.minor, currency };
        warnings.push({
          code: "CIRCULAR_BASIS_EXCLUDED",
          message:
            `The development-cost worksheet includes professional fees ` +
            `(${toMajor(fees).toLocaleString()}). Those have been excluded from the fee ` +
            `basis to avoid calculating the fee from itself.`,
        });
      } else {
        amount = { minor: gross.minor - fees.minor, currency };
        warnings.push({
          code: "CIRCULAR_BASIS_GROSSED_UP",
          message:
            "The development-cost worksheet includes professional fees. The fee will be " +
            "grossed up so it is consistent with forming part of the development cost.",
        });
      }
    } else {
      amount = gross;
    }
  } else {
    amount = fromMajor(input.amount ?? 0, currency);
  }

  // An estimate-sourced basis must say WHICH figure it took — the estimate's grand total
  // already contains the estimator's profit and overhead, so the two are not
  // interchangeable (03-CRITICAL-REVIEW.md §A5).
  if (input.sourceId && !input.sourceField) {
    warnings.push({
      code: "BASIS_WITHOUT_SOURCE_FIELD",
      message:
        "The cost basis came from an estimate but does not record which figure was used " +
        "(direct cost or grand total). State it so the proposal is reproducible.",
    });
  }

  // Drift: the basis changed since the fee was last agreed. Never auto-recalculated.
  if (input.previousAmount !== null && input.previousAmount !== undefined) {
    const previous = fromMajor(input.previousAmount, currency);
    if (previous.minor !== amount.minor && previous.minor !== 0) {
      const delta = amount.minor - previous.minor;
      const pct = Math.round((delta / previous.minor) * 10000) / 100;
      warnings.push({
        code: "COST_BASIS_DRIFT",
        message:
          `The cost basis changed from ${toMajor(previous).toLocaleString()} to ` +
          `${toMajor(amount).toLocaleString()} (${delta > 0 ? "+" : ""}${pct}%). ` +
          `Review the fee — it has not been recalculated automatically.`,
      });
    }
  }

  return {
    basis: {
      type: input.type,
      label: COST_BASIS_LABEL[input.type],
      amount: toMajor(amount),
      sourceField: input.sourceField ?? null,
      sourceId: input.sourceId ?? null,
      circularHandling,
    },
    amount,
    warnings,
    errors,
  };
}

/**
 * Gross-up factor for a circular basis: fee = base x r / (1 - r).
 * Returns null when r >= 1, where the formula diverges — the caller raises
 * GROSS_UP_RATE_TOO_HIGH rather than producing Infinity or NaN.
 */
export function grossUpFactor(percent: number): number | null {
  const r = percent / 100;
  if (!Number.isFinite(r) || r >= 1 || r < 0) return null;
  return r / (1 - r);
}
