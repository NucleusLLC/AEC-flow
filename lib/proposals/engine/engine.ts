/**
 * The Service Proposal fee engine.
 *
 * ONE function computes every monetary figure on a proposal: `computeProposal`. The wizard
 * calls it for live preview and the server calls it before persisting. Because it is pure
 * and deterministic, the preview and the stored total cannot disagree.
 *
 * Order of operations (this is the order printed on the document, and the spec's):
 *
 *   fee components  ->  base fee + selected optional + reimbursables  =  subtotal
 *   subtotal        -   discounts                                     =  after discount
 *   taxable portion x  tax rate                                       =  tax
 *   after discount  +   tax                                           =  grand total
 *
 * Held deliberately OUTSIDE the grand total: unselected optional services (priced, not
 * bought) and additional services (out of scope, informational).
 *
 * PURE — no I/O, no Prisma, no Date.now(). See 02-TECHNICAL-ARCHITECTURE.md §3.
 */
import {
  add,
  allocate,
  allocateByPercent,
  applyPercent,
  fromMajor,
  money,
  multiply,
  sum,
  toMajor,
  zero,
  type Money,
} from "./money";
import { grossUpFactor, resolveCostBasis } from "./basis";
import {
  IMPLEMENTED_METHODS,
  LUMP_METHODS,
  RATE_METHODS,
  MARKUP_METHODS,
  FEE_METHOD_LABEL,
  RATE_METHOD_UNIT,
  type AllocationResult,
  type AuditStep,
  type Diagnostic,
  type FeeComponentInput,
  type FeeComponentResult,
  type ProposalCalcInput,
  type ProposalCalcResult,
  type ProposalTotals,
} from "./types";

/** Percentages that should total 100 are checked with a small tolerance for float dust. */
const PERCENT_TOLERANCE = 0.005;

function fmt(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface ComputedComponent {
  result: FeeComponentResult;
  effective: Money;
}

/**
 * Compute one fee component. Returns the calculated amount, any override, and the formula
 * string used for the audit trail. The calculated value is ALWAYS preserved — an override
 * sits beside it, never on top of it.
 */
function computeComponent(
  c: FeeComponentInput,
  basisAmount: Money,
  hasBasis: boolean,
  currency: string,
  grossUp: boolean,
  errors: Diagnostic[],
  warnings: Diagnostic[],
): ComputedComponent {
  let calculated = zero(currency);
  let formula = "";

  const n = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);

  // Every FeeMethod is now implemented; this stays as a safety net if the enum grows.
  if (!IMPLEMENTED_METHODS.includes(c.method)) {
    errors.push({
      code: "METHOD_NOT_IMPLEMENTED",
      message: `Fee method "${c.method}" is not available yet (${c.label}).`,
      ref: c.id,
    });
  } else if (LUMP_METHODS.includes(c.method)) {
    // FIXED / RETAINER / MILESTONE — a lump sum. Distinct labels, identical arithmetic.
    if (Number.isNaN(n(c.fixedAmount))) {
      errors.push({
        code: "FIXED_WITHOUT_AMOUNT",
        message: `"${c.label}" (${FEE_METHOD_LABEL[c.method].toLowerCase()}) needs an amount.`,
        ref: c.id,
      });
    } else {
      calculated = fromMajor(c.fixedAmount as number, currency);
      formula = FEE_METHOD_LABEL[c.method];
    }
  } else if (RATE_METHODS.includes(c.method)) {
    // HOURLY / PER_AREA / PER_UNIT / PER_DELIVERABLE / MONTHLY — quantity × unit rate.
    const qty = n(c.quantity);
    const rate = n(c.unitRate);
    if (Number.isNaN(qty) || Number.isNaN(rate) || qty <= 0) {
      errors.push({
        code: "RATE_INPUTS_MISSING",
        message: `"${c.label}" (${FEE_METHOD_LABEL[c.method].toLowerCase()}) needs a quantity and a rate.`,
        ref: c.id,
      });
    } else {
      calculated = multiply(fromMajor(rate, currency), qty);
      formula = `${qty} ${RATE_METHOD_UNIT[c.method] ?? "units"} x ${fmt(rate)}`;
    }
  } else if (MARKUP_METHODS.includes(c.method)) {
    // COST_PLUS / SUBCONSULTANT_PLUS_MARKUP — base cost plus a markup percentage.
    const base = n(c.baseAmount);
    const markup = Number.isNaN(n(c.markupPercent)) ? 0 : (c.markupPercent as number);
    if (Number.isNaN(base) || base < 0) {
      errors.push({
        code: "MARKUP_BASE_MISSING",
        message: `"${c.label}" (${FEE_METHOD_LABEL[c.method].toLowerCase()}) needs a base cost.`,
        ref: c.id,
      });
    } else {
      const b = fromMajor(base, currency);
      calculated = add(b, applyPercent(b, markup));
      formula = `${fmt(base)} + ${markup}% markup`;
    }
  } else if (c.method === "PERCENT_OF_BASIS") {
    if (!hasBasis || basisAmount.minor === 0) {
      errors.push({
        code: "PERCENT_WITHOUT_BASIS",
        message: `"${c.label}" is a percentage fee but no cost basis has been set.`,
        ref: c.id,
      });
    } else if (c.percent === null || c.percent === undefined || !Number.isFinite(c.percent)) {
      errors.push({
        code: "PERCENT_MISSING",
        message: `"${c.label}" is a percentage fee but no percentage has been entered.`,
        ref: c.id,
      });
    } else if (grossUp) {
      const factor = grossUpFactor(c.percent);
      if (factor === null) {
        errors.push({
          code: "GROSS_UP_RATE_TOO_HIGH",
          message:
            `"${c.label}" cannot be grossed up at ${c.percent}% — the gross-up formula ` +
            `requires a rate below 100%.`,
          ref: c.id,
        });
      } else {
        calculated = money(Math.round(basisAmount.minor * factor), currency);
        formula = `${fmt(toMajor(basisAmount))} x ${c.percent}% / (1 - ${c.percent}%)`;
      }
    } else {
      calculated = applyPercent(basisAmount, c.percent);
      formula = `${fmt(toMajor(basisAmount))} x ${c.percent}%`;
    }
  }

  const hasOverride = c.overrideAmount !== null && c.overrideAmount !== undefined;
  const override = hasOverride ? fromMajor(c.overrideAmount as number, currency) : null;

  if (hasOverride) {
    if (!c.overrideReason || !c.overrideReason.trim()) {
      errors.push({
        code: "OVERRIDE_WITHOUT_REASON",
        message: `"${c.label}" has a manual fee override but no reason was recorded.`,
        ref: c.id,
      });
    } else {
      warnings.push({
        code: "FEE_OVERRIDDEN",
        message:
          `"${c.label}" was manually overridden from ${fmt(toMajor(calculated))} to ` +
          `${fmt(toMajor(override as Money))} — ${c.overrideReason}`,
        ref: c.id,
      });
    }
  }

  const effective = override ?? calculated;

  // Optional services only count when selected; additional services never count.
  const countedInTotal =
    c.category === "BASE" || (c.category === "OPTIONAL" && c.selected === true);

  return {
    effective,
    result: {
      id: c.id,
      label: c.label,
      disciplineKey: c.disciplineKey ?? null,
      category: c.category,
      method: c.method,
      calculatedAmount: toMajor(calculated),
      overrideAmount: override ? toMajor(override) : null,
      effectiveAmount: toMajor(effective),
      overrideDelta: override ? toMajor(effective) - toMajor(calculated) : 0,
      taxable: c.taxable !== false,
      countedInTotal,
      formula,
    },
  };
}

/** Sum a percentage list and report whether it totals 100 within tolerance. */
function percentTotal(values: number[]): { total: number; balanced: boolean } {
  const total = Math.round(values.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0) * 100) / 100;
  return { total, balanced: Math.abs(total - 100) < PERCENT_TOLERANCE };
}

export function computeProposal(input: ProposalCalcInput): ProposalCalcResult {
  const currency = input.currency;
  const warnings: Diagnostic[] = [];
  const errors: Diagnostic[] = [];
  const auditTrail: AuditStep[] = [];

  // ── 1. Cost basis ────────────────────────────────────────────────────────────
  const resolvedBasis = resolveCostBasis(input.costBasis, currency);
  warnings.push(...resolvedBasis.warnings);
  errors.push(...resolvedBasis.errors);
  const hasBasis = resolvedBasis.basis !== null;
  const grossUp = resolvedBasis.basis?.circularHandling === "GROSS_UP";

  if (resolvedBasis.basis) {
    auditTrail.push({
      label: `Cost basis — ${resolvedBasis.basis.label}`,
      formula: resolvedBasis.basis.sourceField
        ? `from estimate (${resolvedBasis.basis.sourceField})`
        : "entered",
      amount: resolvedBasis.basis.amount,
    });
  }

  // ── 2. Fee components ────────────────────────────────────────────────────────
  const components = (input.feeComponents ?? []).map((c) =>
    computeComponent(c, resolvedBasis.amount, hasBasis, currency, grossUp, errors, warnings),
  );

  if (components.length === 0) {
    warnings.push({
      code: "NO_FEE_COMPONENTS",
      message: "This proposal has no fee components yet.",
    });
  }

  for (const c of components) {
    if (c.result.formula) {
      auditTrail.push({
        label: c.result.label,
        formula: c.result.formula,
        amount: c.result.calculatedAmount,
      });
    }
    if (c.result.overrideAmount !== null) {
      auditTrail.push({
        label: `${c.result.label} — manual override`,
        formula: `was ${fmt(c.result.calculatedAmount)}`,
        amount: c.result.overrideAmount,
      });
    }
  }

  const pick = (predicate: (c: ComputedComponent) => boolean): Money =>
    sum(components.filter(predicate).map((c) => c.effective), currency);

  const baseFeeTotal = pick((c) => c.result.category === "BASE");
  const optionalSelected = pick((c) => c.result.category === "OPTIONAL" && c.result.countedInTotal);
  const optionalUnselected = pick(
    (c) => c.result.category === "OPTIONAL" && !c.result.countedInTotal,
  );
  const additional = pick((c) => c.result.category === "ADDITIONAL");
  const optionalAll = add(optionalSelected, optionalUnselected);

  auditTrail.push({
    label: "Base professional fees",
    formula: "sum of base components",
    amount: toMajor(baseFeeTotal),
  });

  // ── 3. Reimbursables ─────────────────────────────────────────────────────────
  const reimbursables = input.reimbursables ?? [];
  const reimbursablesTotal = sum(
    reimbursables.map((r) => fromMajor(r.amount, currency)),
    currency,
  );

  // ── 4. Subtotal ──────────────────────────────────────────────────────────────
  const subtotal = add(add(baseFeeTotal, optionalSelected), reimbursablesTotal);
  auditTrail.push({ label: "Subtotal", formula: "base + selected optional + reimbursables", amount: toMajor(subtotal) });

  // ── 5. Discounts ─────────────────────────────────────────────────────────────
  // Applied to the subtotal. The original figures are never mutated — the document shows
  // Original -> Less discount -> Adjusted, which the spec requires.
  let discountTotal = zero(currency);
  for (const d of input.discounts ?? []) {
    const amount =
      d.type === "PERCENT" ? applyPercent(subtotal, d.value) : fromMajor(d.value, currency);
    discountTotal = add(discountTotal, amount);
    auditTrail.push({
      label: `Discount — ${d.label}`,
      formula: d.type === "PERCENT" ? `${fmt(toMajor(subtotal))} x ${d.value}%` : "fixed",
      amount: -toMajor(amount),
    });
  }
  const afterDiscount = money(subtotal.minor - discountTotal.minor, currency);

  // ── 6. Tax ───────────────────────────────────────────────────────────────────
  // Only taxable lines are taxed. The discount is apportioned across lines in proportion
  // to their value, using exact allocation so no cent is created or lost.
  const taxableLines: Money[] = [
    ...components.filter((c) => c.result.countedInTotal && c.result.taxable).map((c) => c.effective),
    ...reimbursables.filter((r) => r.taxable !== false).map((r) => fromMajor(r.amount, currency)),
  ];
  const allCountedLines: Money[] = [
    ...components.filter((c) => c.result.countedInTotal).map((c) => c.effective),
    ...reimbursables.map((r) => fromMajor(r.amount, currency)),
  ];

  const taxableGross = sum(taxableLines, currency);
  let taxableSubtotal = taxableGross;

  if (discountTotal.minor > 0 && allCountedLines.length > 0) {
    // Apportion the discount by line value; the taxable share is the part landing on
    // taxable lines.
    const weights = allCountedLines.map((m) => Math.abs(m.minor));
    const spread = allocate(discountTotal, weights);
    let taxableDiscount = zero(currency);
    let i = 0;
    for (const c of components.filter((x) => x.result.countedInTotal)) {
      if (c.result.taxable) taxableDiscount = add(taxableDiscount, spread[i]);
      i += 1;
    }
    for (const r of reimbursables) {
      if (r.taxable !== false) taxableDiscount = add(taxableDiscount, spread[i]);
      i += 1;
    }
    taxableSubtotal = money(taxableGross.minor - taxableDiscount.minor, currency);
  }

  let taxTotal = zero(currency);
  for (const t of input.taxes ?? []) {
    if (!Number.isFinite(t.percent) || t.percent === 0) continue;
    if (t.mode === "INCLUSIVE") {
      // The price already contains the tax: tax = gross - gross / (1 + r)
      const divisor = 1 + t.percent / 100;
      const net = money(Math.round(taxableSubtotal.minor / divisor), currency);
      const inc = money(taxableSubtotal.minor - net.minor, currency);
      taxTotal = add(taxTotal, inc);
      auditTrail.push({
        label: `${t.name} (${t.percent}%, included)`,
        formula: `${fmt(toMajor(taxableSubtotal))} - ${fmt(toMajor(taxableSubtotal))} / ${divisor}`,
        amount: toMajor(inc),
      });
    } else {
      const exc = applyPercent(taxableSubtotal, t.percent);
      taxTotal = add(taxTotal, exc);
      auditTrail.push({
        label: `${t.name} (${t.percent}%)`,
        formula: `${fmt(toMajor(taxableSubtotal))} x ${t.percent}%`,
        amount: toMajor(exc),
      });
    }
  }

  const inclusiveOnly =
    (input.taxes ?? []).length > 0 && (input.taxes ?? []).every((t) => t.mode === "INCLUSIVE");
  // Tax-inclusive pricing does not add to the total — it is already inside it.
  const grandTotal = inclusiveOnly ? afterDiscount : add(afterDiscount, taxTotal);

  auditTrail.push({ label: "Grand total", formula: "after discount + tax", amount: toMajor(grandTotal) });

  if (grandTotal.minor < 0) {
    errors.push({
      code: "NEGATIVE_TOTAL",
      message: "The proposal total is negative. Check the discounts and fee amounts.",
    });
  }

  // ── 7. Phase allocation (of the base fee) ────────────────────────────────────
  const phaseInputs = input.phases ?? [];
  const phasePct = percentTotal(phaseInputs.map((p) => p.percent));
  if (phaseInputs.length > 0 && !phasePct.balanced) {
    warnings.push({
      code: "PHASE_ALLOCATION_NOT_100",
      message: `Design phase percentages total ${phasePct.total}%, not 100%.`,
    });
  }
  // When balanced, allocate() consumes the fee exactly. When not, honour the percentages
  // literally so the shortfall stays visible rather than being silently absorbed.
  const phaseAmounts = phaseInputs.length
    ? phasePct.balanced
      ? allocate(baseFeeTotal, phaseInputs.map((p) => p.percent))
      : allocateByPercent(baseFeeTotal, phaseInputs.map((p) => p.percent))
    : [];
  const phases: AllocationResult[] = phaseInputs.map((p, i) => ({
    id: p.id,
    name: p.name,
    percent: p.percent,
    amount: toMajor(phaseAmounts[i]),
  }));

  // ── 8. Payment schedule (of the grand total) ─────────────────────────────────
  const milestoneInputs = input.paymentMilestones ?? [];
  const milestonePct = percentTotal(milestoneInputs.map((m) => m.percent));
  if (milestoneInputs.length > 0 && !milestonePct.balanced) {
    warnings.push({
      code: "PAYMENT_SCHEDULE_NOT_100",
      message: `Payment schedule totals ${milestonePct.total}%, not 100% — it does not reconcile to the proposal total.`,
    });
  }
  const milestoneAmounts = milestoneInputs.length
    ? milestonePct.balanced
      ? allocate(grandTotal, milestoneInputs.map((m) => m.percent))
      : allocateByPercent(grandTotal, milestoneInputs.map((m) => m.percent))
    : [];
  const paymentSchedule: AllocationResult[] = milestoneInputs.map((m, i) => ({
    id: m.id,
    name: m.name,
    percent: m.percent,
    amount: toMajor(milestoneAmounts[i]),
  }));

  const totals: ProposalTotals = {
    baseFeeTotal: toMajor(baseFeeTotal),
    optionalSelectedTotal: toMajor(optionalSelected),
    optionalUnselectedTotal: toMajor(optionalUnselected),
    optionalServicesTotal: toMajor(optionalAll),
    additionalServicesTotal: toMajor(additional),
    reimbursablesTotal: toMajor(reimbursablesTotal),
    subtotal: toMajor(subtotal),
    discountTotal: toMajor(discountTotal),
    taxableSubtotal: toMajor(taxableSubtotal),
    taxTotal: toMajor(taxTotal),
    grandTotal: toMajor(grandTotal),
  };

  return {
    currency,
    basis: resolvedBasis.basis,
    components: components.map((c) => c.result),
    phases,
    paymentSchedule,
    totals,
    warnings,
    errors,
    auditTrail,
    isValid: errors.length === 0,
  };
}
