/**
 * The zod gate for invoices. PURE.
 *
 * Every server action re-parses its payload through this before the data layer
 * sees it, because an action is a public endpoint and the form in front of it is
 * a convenience, not a control. The messages are written for the person who
 * typed the thing, not for a log.
 *
 * WHAT IT REFUSES, AND WHY EACH ONE MATTERS ON AN INVOICE:
 *   · an invoice with no lines — a document asking for nothing;
 *   · a line with no description — a charge nobody can query;
 *   · a negative line amount — a credit dressed as a charge (credit notes are
 *     their own thing and are not in this release);
 *   · a payment of zero or less — "received nothing" is not a receipt;
 *   · a due date before the issue date;
 *   · a tax percentage outside 0–100.
 */
import { z } from "zod";
import { MAX_HOURS_PER_DAY } from "./timesheet";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from "./types";

const dateOnly = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date in the form YYYY-MM-DD")
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00`)), "That is not a real date");

const optionalDate = z
  .union([dateOnly, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));

const optionalText = (max: number, label = "This") =>
  z
    .union([z.string().max(max, `${label} is too long (max ${max} characters)`), z.null()])
    .optional()
    .transform((v) => {
      const t = typeof v === "string" ? v.trim() : v;
      return t === "" || t === undefined ? null : (t ?? null);
    });

/** Money in, from a number or the string an input gives back. */
const amount = (label: string) =>
  z
    .union([z.number(), z.string()])
    .transform((v) => (typeof v === "number" ? v : Number(v.replace(/[\s,]/g, ""))))
    .refine((n) => Number.isFinite(n), `${label} is not a number`);

const optionalPositive = (label: string) =>
  z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (v === null || v === undefined || v === "") return null;
      const n = typeof v === "number" ? v : Number(String(v).replace(/[\s,]/g, ""));
      return Number.isFinite(n) ? n : null;
    })
    .refine((n) => n === null || n >= 0, `${label} cannot be negative`);

const enumOf = <T extends string>(values: readonly T[], label: string) =>
  z.string().refine((v): v is T => (values as readonly string[]).includes(v), {
    message: `Not a ${label} this app knows`,
  }) as unknown as z.ZodType<T>;

export const invoiceLineSchema = z.object({
  description: z.string().trim().min(1, "Every line needs a description").max(500),
  milestoneId: optionalText(120),
  milestoneName: optionalText(200),
  quantity: optionalPositive("A quantity"),
  unitRate: optionalPositive("A unit rate"),
  amount: amount("A line amount").refine((n) => n >= 0, "A line amount cannot be negative"),
  taxable: z.boolean().optional().transform((v) => v ?? true),
});

export const invoiceInputSchema = z
  .object({
    number: optionalText(40),
    currency: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/, "A currency is three letters, e.g. AWG")
      .optional(),
    clientId: optionalText(120),
    clientName: z.string().trim().min(1, "Say who this is billed to").max(200),
    contactName: optionalText(200),
    contactEmail: z
      .union([z.string().trim().email("That is not an email address"), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
    billingAddress: optionalText(500),
    projectId: optionalText(120),
    projectName: optionalText(200),
    serviceProposalId: optionalText(120),
    proposalNumber: optionalText(60),
    title: optionalText(200),
    intro: optionalText(4000, "The introduction"),
    issueDate: optionalDate,
    dueDate: optionalDate,
    termsDays: z
      .union([z.number(), z.string(), z.null()])
      .optional()
      .transform((v) => {
        if (v === null || v === undefined || v === "") return null;
        const n = typeof v === "number" ? v : Number(v);
        return Number.isFinite(n) ? Math.trunc(n) : null;
      })
      .refine((n) => n === null || (n >= 0 && n <= 365), "Payment terms run from 0 to 365 days"),
    taxName: optionalText(120),
    taxPercent: z
      .union([z.number(), z.string(), z.null()])
      .optional()
      .transform((v) => {
        if (v === null || v === undefined || v === "") return 0;
        const n = typeof v === "number" ? v : Number(v);
        return Number.isFinite(n) ? n : 0;
      })
      .refine((n) => n >= 0 && n <= 100, "A tax percentage runs from 0 to 100"),
    taxMode: enumOf(["EXCLUSIVE", "INCLUSIVE"] as const, "tax mode").optional(),
    notes: optionalText(4000, "The notes"),
    footer: optionalText(2000, "The footer"),
    lines: z.array(invoiceLineSchema).min(1, "An invoice needs at least one line"),
  })
  .refine((v) => !(v.dueDate && v.issueDate) || v.dueDate >= v.issueDate, {
    message: "The due date cannot be before the issue date",
    path: ["dueDate"],
  })
  // A tax name without a rate is a label on nothing; a rate without a name
  // prints an unexplained charge. Both together, or neither.
  .refine((v) => !(v.taxPercent > 0) || Boolean(v.taxName), {
    message: "Name the tax that is being charged",
    path: ["taxName"],
  });

export const invoicePaymentSchema = z.object({
  paidAt: dateOnly,
  amount: amount("The payment").refine((n) => n > 0, "A payment has to be more than zero"),
  method: enumOf(PAYMENT_METHODS, "payment method"),
  reference: optionalText(120),
  notes: optionalText(2000, "The notes"),
});

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: { path: string; message: string }[] };

function parse<T>(schema: z.ZodType<T>, data: unknown): ParseResult<T> {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, value: result.data };
  return {
    ok: false,
    issues: result.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    })),
  };
}

export function parseInvoiceInput(data: unknown) {
  return parse(invoiceInputSchema, data);
}

export function parseInvoicePaymentInput(data: unknown) {
  return parse(invoicePaymentSchema, data);
}

// ── Time and expenses ──────────────────────────────────────────────────────
//
// WHAT THESE REFUSE, AND WHY EACH ONE MATTERS ON A TIMESHEET:
//   · zero or negative hours — an entry that says no work was done;
//   · more than 24 hours in a day — a typed 80 that becomes a billed 80;
//   · an expense of zero or less — a receipt for nothing, or a credit dressed
//     as a cost;
//   · a markup outside 0-100 — the client pays at cost or above it, and a
//     mistyped 1000 is not a handling fee;
//   · an expense with no description — a charge nobody can query months later.

export const timeEntrySchema = z.object({
  userId: optionalText(120),
  projectId: optionalText(120),
  phaseId: optionalText(120),
  date: dateOnly,
  hours: amount("The hours")
    .refine((n) => n > 0, "Log more than zero hours")
    .refine((n) => n <= MAX_HOURS_PER_DAY, `Nobody works more than ${MAX_HOURS_PER_DAY} hours in a day`),
  billable: z.boolean().optional().transform((v) => v ?? true),
  chargeRate: optionalPositive("A charge-out rate"),
  costRate: optionalPositive("A cost rate"),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/, "A currency is three letters, e.g. AWG")
    .optional(),
  description: optionalText(1000, "The description"),
});

export const expenseSchema = z.object({
  userId: optionalText(120),
  projectId: optionalText(120),
  date: dateOnly,
  category: enumOf(EXPENSE_CATEGORIES, "expense category"),
  vendor: optionalText(200),
  description: z.string().trim().min(1, "Say what the money was spent on").max(500),
  amount: amount("The amount").refine((n) => n > 0, "An expense has to be more than zero"),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/, "A currency is three letters, e.g. AWG")
    .optional(),
  billable: z.boolean().optional().transform((v) => v ?? true),
  markupPercent: z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (v === null || v === undefined || v === "") return 0;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : 0;
    })
    .refine((n) => n >= 0 && n <= 100, "A markup runs from 0 to 100 percent"),
  reimbursable: z.boolean().optional().transform((v) => v ?? false),
});

/** A rejection needs a reason: "rejected" with no note is an argument next week. */
export const approvalDecisionSchema = z
  .object({
    approve: z.boolean(),
    reason: optionalText(500, "The reason"),
  })
  .refine((v) => v.approve || Boolean(v.reason), {
    message: "Say why it is being sent back",
    path: ["reason"],
  });

export function parseTimeEntryInput(data: unknown) {
  return parse(timeEntrySchema, data);
}

export function parseExpenseInput(data: unknown) {
  return parse(expenseSchema, data);
}

export function parseApprovalDecision(data: unknown) {
  return parse(approvalDecisionSchema, data);
}

/** One sentence a user can act on, rather than a JSON dump of issues. */
export function issuesToMessage(issues: { path: string; message: string }[]): string {
  if (issues.length === 0) return "That could not be saved.";
  return issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join(". ");
}
