/**
 * Validation schemas for the Service Proposal module — the first use of zod in this
 * codebase.
 *
 * These are the AUTHORITATIVE gate: the server action parses every payload through
 * `serviceProposalInputSchema` before it reaches the data layer. The wizard may run the
 * same schemas for instant feedback, but client validation is a courtesy — nothing is
 * trusted until it has passed here on the server.
 *
 * Two distinct concerns, kept separate on purpose:
 *   - STRUCTURAL validity (this file): shapes, types, required fields, ranges. Blocking.
 *   - FINANCIAL warnings (the engine): allocation ≠ 100%, cost-basis drift, etc.
 *     Non-blocking, surfaced as guidance. A proposal can be saved as a draft while it still
 *     has financial warnings; it just cannot be *issued*.
 *
 * The field set mirrors lib/proposals/engine/types.ts. Where a value feeds the engine, the
 * schema's output type is assignable to the engine input — verified by a type-level check
 * in the test file.
 */
import { z } from "zod";

// ── Primitives ───────────────────────────────────────────────────────────────

/** A monetary amount in major units. Finite, non-negative, at most 2 decimals.
 *
 *  The cent check round-trips through `toFixed(2)` rather than comparing `n * 100` to its
 *  rounded self. Multiplying by 100 introduces IEEE-754 error, so the naive form rejected
 *  perfectly legal two-decimal amounts — 8.29 * 100 is 828.9999999999999 and 1120.35 * 100
 *  is 112034.99999999999, neither of which equals its own rounding. `toFixed(2)` formats
 *  from the decimal value, so a genuine two-decimal amount round-trips exactly while true
 *  sub-cent precision (100.005) still does not. */
const moneyAmount = z
  .number()
  .finite("Amount must be a number")
  .nonnegative("Amount cannot be negative")
  .refine((n) => Number(n.toFixed(2)) === n, "Amount cannot have more than 2 decimal places");

/** A percentage (0–100 by default). Fees above 100% are almost always a typo. */
const percent = (max = 100) =>
  z.number().finite("Percentage must be a number").min(0, "Percentage cannot be negative").max(max, `Percentage cannot exceed ${max}`);

const nonEmpty = (label: string) => z.string().trim().min(1, `${label} is required`);
const optionalText = z.string().trim().optional().nullable();

const isoDate = z
  .string()
  .trim()
  .refine((s) => s === "" || !Number.isNaN(Date.parse(s)), "Must be a valid date")
  .optional()
  .nullable();

// ── Enums (kept in lock-step with engine/types.ts and engine/status.ts) ───────

export const costBasisTypeSchema = z.enum([
  "ESTIMATED_CONSTRUCTION_COST",
  "APPROVED_CONSTRUCTION_BUDGET",
  "CONTRACTOR_CONTRACT_SUM",
  "TOTAL_DEVELOPMENT_COST",
  "CONSTRUCTION_EXCL_LAND",
  "CONSTRUCTION_EXCL_FFE",
  "CONSTRUCTION_EXCL_EQUIPMENT",
  "CONSTRUCTION_EXCL_TAXES",
  "CONSTRUCTION_EXCL_FINANCING",
  "CUSTOM",
]);

export const feeMethodSchema = z.enum([
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
]);

export const serviceCategorySchema = z.enum(["BASE", "OPTIONAL", "ADDITIONAL"]);
export const taxModeSchema = z.enum(["EXCLUSIVE", "INCLUSIVE"]);
export const discountTypeSchema = z.enum(["PERCENT", "FIXED"]);
export const circularHandlingSchema = z.enum(["EXCLUDE_OWN_FEE", "GROSS_UP"]);

export const serviceProposalKindSchema = z.enum(["QUICK", "ADVANCED"]);

export const serviceProposalStatusSchema = z.enum([
  "DRAFT",
  "INTERNAL_REVIEW",
  "APPROVED_FOR_ISSUE",
  "SENT",
  "UNDER_CLIENT_REVIEW",
  "REVISION_REQUESTED",
  "REVISED",
  "ACCEPTED",
  "PARTIALLY_ACCEPTED",
  "REJECTED",
  "EXPIRED",
  "WITHDRAWN",
  "SUPERSEDED",
  "CONVERTED",
]);

// ── Section schemas ───────────────────────────────────────────────────────────

export const developmentCostItemSchema = z.object({
  category: nonEmpty("Category"),
  amount: moneyAmount,
  includedInBasis: z.boolean(),
  isProfessionalFees: z.boolean().optional(),
  notes: optionalText,
});

export const costBasisSchema = z
  .object({
    type: costBasisTypeSchema,
    amount: moneyAmount.optional().nullable(),
    sourceField: optionalText,
    sourceId: optionalText,
    worksheet: z.array(developmentCostItemSchema).optional(),
    circularHandling: circularHandlingSchema.optional(),
    previousAmount: moneyAmount.optional().nullable(),
  })
  .refine(
    // A development-cost basis needs a worksheet; every other basis needs an amount.
    (b) =>
      b.type === "TOTAL_DEVELOPMENT_COST"
        ? (b.worksheet?.length ?? 0) > 0 || (b.amount ?? 0) > 0
        : (b.amount ?? 0) > 0,
    { message: "Provide a cost basis amount (or a development-cost worksheet).", path: ["amount"] },
  );

export const feeComponentSchema = z
  .object({
    id: nonEmpty("Component id"),
    label: nonEmpty("Fee description"),
    disciplineKey: optionalText,
    method: feeMethodSchema,
    category: serviceCategorySchema,
    percent: percent().optional().nullable(),
    fixedAmount: moneyAmount.optional().nullable(),
    quantity: z.number().finite().nonnegative().optional().nullable(),
    unitRate: moneyAmount.optional().nullable(),
    baseAmount: moneyAmount.optional().nullable(),
    markupPercent: z.number().finite().min(0).max(1000).optional().nullable(),
    selected: z.boolean().optional(),
    taxable: z.boolean().optional(),
    overrideAmount: moneyAmount.optional().nullable(),
    overrideReason: optionalText,
  })
  .refine((c) => c.method !== "PERCENT_OF_BASIS" || (c.percent ?? 0) > 0, {
    message: "A percentage fee needs a percentage.",
    path: ["percent"],
  })
  .refine((c) => c.method !== "FIXED" || (c.fixedAmount ?? 0) > 0, {
    message: "A fixed fee needs an amount.",
    path: ["fixedAmount"],
  })
  .refine(
    // An override figure without a reason is rejected — the audit trail must explain it.
    (c) =>
      c.overrideAmount === null ||
      c.overrideAmount === undefined ||
      (typeof c.overrideReason === "string" && c.overrideReason.trim().length > 0),
    { message: "A manual fee override needs a reason.", path: ["overrideReason"] },
  );

export const phaseSchema = z.object({
  id: nonEmpty("Phase id"),
  name: nonEmpty("Phase name"),
  percent: percent(),
});

export const paymentMilestoneSchema = z.object({
  id: nonEmpty("Milestone id"),
  name: nonEmpty("Milestone name"),
  trigger: optionalText,
  percent: percent(),
});

export const reimbursableSchema = z.object({
  id: nonEmpty("Reimbursable id"),
  label: nonEmpty("Reimbursable description"),
  amount: moneyAmount,
  taxable: z.boolean().optional(),
});

export const discountSchema = z.object({
  id: nonEmpty("Discount id"),
  label: nonEmpty("Discount description"),
  type: discountTypeSchema,
  // A percentage discount is 0–100; a fixed discount is a money amount. Both fit in a
  // finite non-negative number, and the engine interprets by `type`.
  value: z.number().finite("Discount value must be a number").nonnegative("Discount cannot be negative"),
  reason: optionalText,
  visibleToClient: z.boolean().optional(),
});

export const taxSchema = z.object({
  name: nonEmpty("Tax name"),
  percent: percent(),
  mode: taxModeSchema,
  registrationNumber: optionalText,
});

export const scopeItemSchema = z.object({
  title: nonEmpty("Scope item"),
  description: optionalText,
  discipline: optionalText,
  category: serviceCategorySchema.default("BASE"),
  /** false = the item is listed as explicitly excluded from scope. */
  included: z.boolean().default(true),
});

export type ScopeItem = z.infer<typeof scopeItemSchema>;

// ── The whole proposal ────────────────────────────────────────────────────────

/**
 * The full create/update payload. `costBasis` is optional so an early draft can be saved
 * before the fee is worked out; the engine reports PERCENT_WITHOUT_BASIS if a percentage
 * component is then present. Issuing (not saving) is what requires the engine to be
 * error-free — that gate lives in the service layer, not here.
 */
export const serviceProposalInputSchema = z.object({
  title: nonEmpty("Proposal title"),
  kind: serviceProposalKindSchema.default("QUICK"),
  status: serviceProposalStatusSchema.optional(),
  clientId: optionalText,
  clientName: optionalText,
  projectId: optionalText,
  projectName: optionalText,
  contactName: optionalText,
  contactEmail: z.union([z.literal(""), z.string().email("Enter a valid email")]).optional().nullable(),
  contactTitle: optionalText,
  currency: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter ISO code (e.g. USD, AWG)"),
  languageCode: optionalText,
  taxJurisdiction: optionalText,

  costBasis: costBasisSchema.optional().nullable(),
  feeComponents: z.array(feeComponentSchema).default([]),
  phases: z.array(phaseSchema).default([]),
  paymentMilestones: z.array(paymentMilestoneSchema).default([]),
  reimbursables: z.array(reimbursableSchema).default([]),
  discounts: z.array(discountSchema).default([]),
  taxes: z.array(taxSchema).default([]),

  scopeSummary: optionalText,
  scopeItems: z.array(scopeItemSchema).default([]),
  exclusions: optionalText,
  assumptions: optionalText,
  terms: optionalText,
  estimatedWeeks: z.number().int().nonnegative().optional().nullable(),
  showFeeDerivation: z.boolean().default(true),

  validUntil: isoDate,
  notes: optionalText,
});

export type ServiceProposalInput = z.infer<typeof serviceProposalInputSchema>;
export type CostBasisSchemaOutput = z.infer<typeof costBasisSchema>;
export type FeeComponentSchemaOutput = z.infer<typeof feeComponentSchema>;

/**
 * Parse and normalise a payload. Returns a discriminated result rather than throwing, so
 * server actions can map issues onto a friendly response.
 */
export function parseServiceProposalInput(
  data: unknown,
):
  | { ok: true; value: ServiceProposalInput }
  | { ok: false; issues: { path: string; message: string }[] } {
  const result = serviceProposalInputSchema.safeParse(data);
  if (result.success) return { ok: true, value: result.data };
  return {
    ok: false,
    issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  };
}
