/**
 * Service Proposal fee engine — input and result types.
 *
 * CLIENT-SAFE. No Prisma, no I/O — the wizard imports these for live preview and the
 * server imports them to persist authoritative totals. Keeping one set of types is what
 * stops the two from drifting.
 *
 * See docs/proposal-module/02-TECHNICAL-ARCHITECTURE.md §3.
 */

/**
 * What a percentage fee is applied to. The basis must always be named on the proposal —
 * a percentage without a stated basis is meaningless to a client and is the single most
 * common source of fee disputes (see 03-CRITICAL-REVIEW.md §A4).
 */
export type CostBasisType =
  | "ESTIMATED_CONSTRUCTION_COST"
  | "APPROVED_CONSTRUCTION_BUDGET"
  | "CONTRACTOR_CONTRACT_SUM"
  | "TOTAL_DEVELOPMENT_COST"
  | "CONSTRUCTION_EXCL_LAND"
  | "CONSTRUCTION_EXCL_FFE"
  | "CONSTRUCTION_EXCL_EQUIPMENT"
  | "CONSTRUCTION_EXCL_TAXES"
  | "CONSTRUCTION_EXCL_FINANCING"
  | "CUSTOM";

export const COST_BASIS_LABEL: Record<CostBasisType, string> = {
  ESTIMATED_CONSTRUCTION_COST: "Estimated construction cost",
  APPROVED_CONSTRUCTION_BUDGET: "Approved construction budget",
  CONTRACTOR_CONTRACT_SUM: "Contractor contract sum",
  TOTAL_DEVELOPMENT_COST: "Total development cost",
  CONSTRUCTION_EXCL_LAND: "Construction cost excluding land",
  CONSTRUCTION_EXCL_FFE: "Construction cost excluding furniture",
  CONSTRUCTION_EXCL_EQUIPMENT: "Construction cost excluding equipment",
  CONSTRUCTION_EXCL_TAXES: "Construction cost excluding taxes",
  CONSTRUCTION_EXCL_FINANCING: "Construction cost excluding financing",
  CUSTOM: "User-defined cost basis",
};

/** The firm's default. Industry convention — see 03-CRITICAL-REVIEW.md §A4. */
export const DEFAULT_COST_BASIS: CostBasisType = "ESTIMATED_CONSTRUCTION_COST";

/**
 * The standard architectural phase split (percentages sum to 100). A new proposal starts
 * from this; every phase is editable per proposal. Client-safe constant so the form and the
 * engine share one definition.
 */
export const DEFAULT_PHASES: readonly { name: string; percentage: number }[] = [
  { name: "Concept Design", percentage: 10 },
  { name: "Schematic Design", percentage: 15 },
  { name: "Design Development", percentage: 35 },
  { name: "Construction Documents", percentage: 40 },
] as const;

/**
 * Fee methods. Release A implements PERCENT_OF_BASIS and FIXED; the remaining members are
 * declared now so the interface is stable and Release B adds calculators, not types.
 */
export type FeeMethod =
  | "PERCENT_OF_BASIS"
  | "FIXED"
  | "HOURLY"
  | "PER_AREA"
  | "PER_UNIT"
  | "PER_DELIVERABLE"
  | "RETAINER"
  | "MONTHLY"
  | "MILESTONE"
  | "COST_PLUS"
  | "SUBCONSULTANT_PLUS_MARKUP";

/**
 * Every method the engine can calculate. HYBRID is intentionally absent: a hybrid fee is not
 * a single component but a proposal carrying several components of different methods, which
 * the model already supports. HYBRID therefore reports a helpful message rather than a value.
 */
export const IMPLEMENTED_METHODS: FeeMethod[] = [
  "PERCENT_OF_BASIS",
  "FIXED",
  "HOURLY",
  "PER_AREA",
  "PER_UNIT",
  "PER_DELIVERABLE",
  "RETAINER",
  "MONTHLY",
  "MILESTONE",
  "COST_PLUS",
  "SUBCONSULTANT_PLUS_MARKUP",
];

/** Methods computed as quantity × unit rate (hours, area, units, deliverables, months). */
export const RATE_METHODS: FeeMethod[] = [
  "HOURLY",
  "PER_AREA",
  "PER_UNIT",
  "PER_DELIVERABLE",
  "MONTHLY",
];

/** Methods that are a plain lump sum (semantically distinct but computed identically). */
export const LUMP_METHODS: FeeMethod[] = ["FIXED", "RETAINER", "MILESTONE"];

/** Methods computed as a base cost plus a markup percentage. */
export const MARKUP_METHODS: FeeMethod[] = ["COST_PLUS", "SUBCONSULTANT_PLUS_MARKUP"];

export const FEE_METHOD_LABEL: Record<FeeMethod, string> = {
  PERCENT_OF_BASIS: "% of cost basis",
  FIXED: "Fixed fee",
  HOURLY: "Hourly",
  PER_AREA: "Per area (m²/ft²)",
  PER_UNIT: "Per unit",
  PER_DELIVERABLE: "Per deliverable",
  RETAINER: "Retainer",
  MONTHLY: "Monthly",
  MILESTONE: "Milestone",
  COST_PLUS: "Cost plus markup",
  SUBCONSULTANT_PLUS_MARKUP: "Subconsultant + markup",
};

/** The unit noun shown beside a rate method's quantity. */
export const RATE_METHOD_UNIT: Partial<Record<FeeMethod, string>> = {
  HOURLY: "hours",
  PER_AREA: "area",
  PER_UNIT: "units",
  PER_DELIVERABLE: "deliverables",
  MONTHLY: "months",
};

/**
 * Base services are in the fee. Optional services are priced but only count when selected.
 * Additional services are outside scope and never counted — they are informational, so the
 * client knows the rate should they authorise the work later.
 */
export type ServiceCategory = "BASE" | "OPTIONAL" | "ADDITIONAL";

export type TaxMode = "EXCLUSIVE" | "INCLUSIVE";
export type DiscountType = "PERCENT" | "FIXED";

/** How a circular total-development-cost basis is resolved. */
export type CircularHandling = "EXCLUDE_OWN_FEE" | "GROSS_UP";

export interface DevelopmentCostItem {
  category: string;
  amount: number;
  /** Only included categories form the basis. */
  includedInBasis: boolean;
  /**
   * Marks the "professional fees" line. When such a line is included in the basis and a
   * percentage fee is applied, the calculation is circular — see basis.ts.
   */
  isProfessionalFees?: boolean;
  notes?: string | null;
}

export interface CostBasisInput {
  type: CostBasisType;
  /** Explicit basis amount (major units). Ignored when a worksheet resolves the basis. */
  amount?: number | null;
  /** Which estimate figure was used — "direct" or "grandTotal". Never auto-picked (§A5). */
  sourceField?: string | null;
  sourceId?: string | null;
  /** Worksheet, used when type is TOTAL_DEVELOPMENT_COST. */
  worksheet?: DevelopmentCostItem[];
  circularHandling?: CircularHandling;
  /** Basis at the time the fee was last accepted, for drift detection. */
  previousAmount?: number | null;
}

export interface FeeComponentInput {
  id: string;
  label: string;
  disciplineKey?: string | null;
  method: FeeMethod;
  category: ServiceCategory;
  /** PERCENT_OF_BASIS */
  percent?: number | null;
  /** FIXED / RETAINER / MILESTONE */
  fixedAmount?: number | null;
  /** RATE_METHODS: the count (hours, area, units, deliverables, months). */
  quantity?: number | null;
  /** RATE_METHODS: the rate per unit. */
  unitRate?: number | null;
  /** MARKUP_METHODS: the base cost being marked up. */
  baseAmount?: number | null;
  /** MARKUP_METHODS: markup applied to baseAmount, as a percentage. */
  markupPercent?: number | null;
  /** Optional services only count toward the total when selected. */
  selected?: boolean;
  taxable?: boolean;
  /** A manual override never destroys the calculated value — both are reported. */
  overrideAmount?: number | null;
  overrideReason?: string | null;
}

export interface PhaseInput {
  id: string;
  name: string;
  /** Share of the base fee, as a percentage. Should total 100 across phases. */
  percent: number;
}

export interface PaymentMilestoneInput {
  id: string;
  name: string;
  trigger?: string | null;
  /** Share of the grand total. Should total 100 across milestones. */
  percent: number;
}

export interface ReimbursableInput {
  id: string;
  label: string;
  amount: number;
  taxable?: boolean;
}

export interface DiscountInput {
  id: string;
  label: string;
  type: DiscountType;
  /** Percentage points for PERCENT, or a major-unit amount for FIXED. */
  value: number;
  reason?: string | null;
  visibleToClient?: boolean;
}

export interface TaxInput {
  name: string;
  percent: number;
  mode: TaxMode;
  registrationNumber?: string | null;
}

export interface ProposalCalcInput {
  currency: string;
  costBasis?: CostBasisInput | null;
  feeComponents: FeeComponentInput[];
  phases?: PhaseInput[];
  paymentMilestones?: PaymentMilestoneInput[];
  reimbursables?: ReimbursableInput[];
  discounts?: DiscountInput[];
  taxes?: TaxInput[];
}

// ── Results ────────────────────────────────────────────────────────────────────

export type DiagnosticCode =
  // errors (blocking)
  | "PERCENT_WITHOUT_BASIS"
  | "PERCENT_MISSING"
  | "FIXED_WITHOUT_AMOUNT"
  | "RATE_INPUTS_MISSING"
  | "MARKUP_BASE_MISSING"
  | "METHOD_NOT_IMPLEMENTED"
  | "OVERRIDE_WITHOUT_REASON"
  | "GROSS_UP_RATE_TOO_HIGH"
  | "NEGATIVE_TOTAL"
  // warnings (non-blocking)
  | "PHASE_ALLOCATION_NOT_100"
  | "PAYMENT_SCHEDULE_NOT_100"
  | "COST_BASIS_DRIFT"
  | "CIRCULAR_BASIS_EXCLUDED"
  | "CIRCULAR_BASIS_GROSSED_UP"
  | "FEE_OVERRIDDEN"
  | "NO_FEE_COMPONENTS"
  | "BASIS_WITHOUT_SOURCE_FIELD";

export interface Diagnostic {
  code: DiagnosticCode;
  message: string;
  /** Fee component / phase / milestone id, when the diagnostic is scoped to one. */
  ref?: string;
}

/** One ordered, human-readable step of the calculation — printed as the fee derivation. */
export interface AuditStep {
  label: string;
  /** e.g. "2,500,000.00 x 7.5%" */
  formula: string;
  /** Major-unit result. */
  amount: number;
}

export interface FeeComponentResult {
  id: string;
  label: string;
  disciplineKey: string | null;
  category: ServiceCategory;
  method: FeeMethod;
  /** What the method produced, always preserved even when overridden. */
  calculatedAmount: number;
  overrideAmount: number | null;
  /** The figure actually used — override when present, else calculated. */
  effectiveAmount: number;
  /** effectiveAmount − calculatedAmount. */
  overrideDelta: number;
  taxable: boolean;
  /** Whether this component contributes to the grand total. */
  countedInTotal: boolean;
  formula: string;
}

export interface AllocationResult {
  id: string;
  name: string;
  percent: number;
  amount: number;
}

export interface BasisResult {
  type: CostBasisType;
  label: string;
  amount: number;
  sourceField: string | null;
  sourceId: string | null;
  /** Set when the total-development-cost circularity was detected and resolved. */
  circularHandling: CircularHandling | null;
}

export interface ProposalTotals {
  baseFeeTotal: number;
  optionalSelectedTotal: number;
  optionalUnselectedTotal: number;
  /** Every priced optional service, selected or not. Never inside grandTotal. */
  optionalServicesTotal: number;
  /** Additional services — informational only, never in any total. */
  additionalServicesTotal: number;
  reimbursablesTotal: number;
  subtotal: number;
  discountTotal: number;
  taxableSubtotal: number;
  taxTotal: number;
  grandTotal: number;
}

export interface ProposalCalcResult {
  currency: string;
  basis: BasisResult | null;
  components: FeeComponentResult[];
  phases: AllocationResult[];
  paymentSchedule: AllocationResult[];
  totals: ProposalTotals;
  warnings: Diagnostic[];
  errors: Diagnostic[];
  auditTrail: AuditStep[];
  /** True when there are no blocking errors — i.e. the proposal may be issued. */
  isValid: boolean;
}
