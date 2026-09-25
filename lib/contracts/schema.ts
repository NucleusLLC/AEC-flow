/**
 * The zod gate for contracts. PURE.
 *
 * Every action and the generate route re-parse their payload through this
 * before the data layer or the model sees it, because an endpoint is public and
 * the form in front of it is a convenience, not a control.
 *
 * WHAT IT REFUSES, AND WHY IT MATTERS ON A CONTRACT:
 *   · no employer or no contractor — a contract needs two parties by name;
 *   · a contract sum of zero or less — there is nothing to agree to;
 *   · an instalment percentage outside 0–100, or more than 24 of them;
 *   · an exchange rate of zero, which would divide the dollar column by nothing;
 *   · a completion date before the commencement date.
 *
 * It does NOT refuse a schedule that fails to total 100%. The pre-flight
 * checklist blocks that at the point a human can fix it; refusing it here as
 * well would only turn a clear message into a validation error.
 */
import { z } from "zod";
import { DEFAULT_EXCHANGE_RATE } from "./types";

const text = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => String(v ?? "").trim().slice(0, max));

const dateOnly = z
  .union([
    z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date in the form YYYY-MM-DD"),
    z.literal(""),
    z.null(),
    z.undefined(),
  ])
  .transform((v) => (typeof v === "string" ? v : ""));

const amount = (label: string) =>
  z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (v === null || v === undefined || v === "") return 0;
      const n = typeof v === "number" ? v : Number(String(v).replace(/[\s,]/g, ""));
      return Number.isFinite(n) ? n : Number.NaN;
    })
    .refine((n) => !Number.isNaN(n), `${label} is not a number`)
    .refine((n) => n >= 0, `${label} cannot be negative`);

const optionalCount = (label: string, max: number) =>
  z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (v === null || v === undefined || v === "") return null;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? Math.trunc(n) : null;
    })
    .refine((n) => n === null || (n >= 0 && n <= max), `${label} is out of range`);

export const phaseSchema = z.object({
  phase: text(40),
  description: text(200),
  detail: text(300),
  percent: z
    .union([z.number(), z.string()])
    .transform((v) => {
      const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
      return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
    })
    .refine((n) => n >= 0 && n <= 100, "An instalment runs from 0 to 100 percent"),
});

export const contractFactsSchema = z
  .object({
    projectId: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((v) => (typeof v === "string" && v.trim() ? v.trim() : null)),
    projectName: text(200),
    projectNumber: text(60),
    siteAddress: text(400),

    employerName: z.string().trim().min(1, "Say who the employer is").max(200),
    employerAddress: text(400),
    employerContact: text(200),
    employerEmail: text(200),
    employerPhone: text(60),

    contractorName: z.string().trim().min(1, "Say who the contractor is").max(200),
    contractorAddress: text(400),
    contractorContact: text(200),
    contractorEmail: text(200),
    contractorPhone: text(60),

    administratorName: text(200),

    contractSum: amount("The contract sum").refine((n) => n > 0, "A contract needs a sum"),
    currency: z
      .union([z.string(), z.undefined()])
      .transform((v) => (v ?? "AWG").trim().toUpperCase() || "AWG")
      .refine((v) => /^[A-Z]{3}$/.test(v), "A currency is three letters, e.g. AWG"),
    exchangeRate: z
      .union([z.number(), z.string(), z.null(), z.undefined()])
      .transform((v) => {
        if (v === null || v === undefined || v === "") return DEFAULT_EXCHANGE_RATE;
        const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
        return Number.isFinite(n) && n > 0 ? n : 0;
      })
      .refine((n) => n > 0, "An exchange rate has to be more than zero"),

    scopeSummary: text(2000),
    commencementDate: dateOnly,
    completionDate: dateOnly,
    contractPeriodDays: optionalCount("The contract period", 3650),
    liquidatedDamagesPerDay: z
      .union([z.number(), z.string(), z.null(), z.undefined()])
      .transform((v) => {
        if (v === null || v === undefined || v === "") return null;
        const n = typeof v === "number" ? v : Number(String(v).replace(/[\s,]/g, ""));
        return Number.isFinite(n) && n > 0 ? n : null;
      }),
    defectsLiabilityMonths: optionalCount("The defects liability period", 120),
    retentionPercent: z
      .union([z.number(), z.string(), z.null(), z.undefined()])
      .transform((v) => {
        if (v === null || v === undefined || v === "") return null;
        const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
        return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
      })
      .refine((n) => n === null || (n >= 0 && n <= 50), "Retention runs from 0 to 50 percent"),

    phases: z.array(phaseSchema).max(24, "That is more instalments than a contract can carry"),
    notes: text(4000),
  })
  .refine(
    (v) => !(v.commencementDate && v.completionDate) || v.completionDate >= v.commencementDate,
    { message: "The completion date cannot be before the commencement date", path: ["completionDate"] },
  );

/** The document coming back from an edit in the browser. */
export const contractBodySchema = z.object({
  language: text(60),
  title: text(300),
  subtitle: text(300),
  parties: z.array(z.object({ role: text(80), text: text(4000) })).max(12),
  recitals: z.array(text(4000)).max(60),
  articles: z
    .array(
      z.object({
        number: text(20),
        heading: text(300),
        paragraphs: z.array(text(20_000)).max(200),
      }),
    )
    .max(200),
  schedule: z
    .array(
      z.object({
        phase: text(40),
        description: text(200),
        detail: text(300),
        percent: z.number().optional().default(0),
        amountAwg: z.number().optional().default(0),
        amountUsd: z.number().optional().default(0),
      }),
    )
    .max(24),
  scheduleArticle: text(20),
  signatures: z.array(z.object({ role: text(80), name: text(200) })).max(12),
  changes: z.array(text(600)).max(200),
  check: z.array(text(600)).max(200),
});

export const templateInputSchema = z.object({
  name: z.string().trim().min(1, "Give the template a name").max(160),
  description: text(400),
  storageKey: z.string().trim().min(1),
  filename: z.string().trim().min(1).max(255),
});

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: { path: string; message: string }[] };

function parse<T>(schema: z.ZodType<T>, data: unknown): ParseResult<T> {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, value: result.data };
  return {
    ok: false,
    issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  };
}

export function parseContractFacts(data: unknown) {
  return parse(contractFactsSchema, data);
}

export function parseContractBody(data: unknown) {
  return parse(contractBodySchema, data);
}

export function parseTemplateInput(data: unknown) {
  return parse(templateInputSchema, data);
}

/** One sentence a user can act on, rather than a JSON dump of issues. */
export function issuesToMessage(issues: { path: string; message: string }[]): string {
  if (issues.length === 0) return "That could not be saved.";
  return issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join(". ");
}
