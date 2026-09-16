/**
 * The zod gate for general documents. PURE.
 *
 * Every server action re-parses here before the data layer sees anything: an
 * action is a public endpoint and the composer in front of it is a convenience.
 *
 * The catalogue is the authority on `docType` — a key that is not in it is
 * refused rather than stored, because a stored key nothing can render is a
 * document that opens blank. The REQUIRED FIELDS of an entry are checked too,
 * but only on issue: a draft is allowed to be half-written, a document that
 * goes out is not.
 */
import { z } from "zod";
import { catalogueEntry } from "./catalogue";
import { requiredMissing } from "./render";

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

export const generalDocumentInputSchema = z
  .object({
    number: optionalText(40),
    docType: z
      .string()
      .trim()
      .min(1, "Choose a document type")
      .refine((key) => catalogueEntry(key) !== null, "That is not a document type this app knows"),
    title: z.string().trim().min(1, "Give the document a title").max(200),
    clientId: optionalText(120),
    clientName: optionalText(200),
    projectId: optionalText(120),
    projectName: optionalText(200),
    counterpartyName: optionalText(200),
    counterpartyAddress: optionalText(500),
    contactName: optionalText(200),
    contactEmail: z
      .union([z.string().trim().email("That is not an email address"), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
    subject: optionalText(200),
    reference: optionalText(80),
    issueDate: optionalDate,
    effectiveDate: optionalDate,
    expiryDate: optionalDate,
    /** Field values, keyed by the catalogue entry's field keys. */
    values: z
      .record(z.string(), z.union([z.string(), z.number(), z.null()]))
      .optional()
      .transform((v) =>
        Object.fromEntries(
          Object.entries(v ?? {})
            .map(([k, value]) => [k, value === null || value === undefined ? "" : String(value)])
            .filter(([, value]) => value !== ""),
        ),
      ),
    body: z
      .array(z.string().max(8000, "A paragraph is too long (max 8000 characters)"))
      .min(1, "The document has no text")
      .transform((paragraphs) => paragraphs.map((p) => p.trim()).filter((p) => p.length > 0)),
    notes: optionalText(4000, "The notes"),
  })
  .refine((v) => v.body.length > 0, { message: "The document has no text", path: ["body"] })
  .refine((v) => !(v.expiryDate && v.effectiveDate) || v.expiryDate >= v.effectiveDate, {
    message: "The expiry date cannot be before the effective date",
    path: ["expiryDate"],
  });

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: { path: string; message: string }[] };

export function parseGeneralDocumentInput(
  data: unknown,
): ParseResult<z.infer<typeof generalDocumentInputSchema>> {
  const result = generalDocumentInputSchema.safeParse(data);
  if (result.success) return { ok: true, value: result.data };
  return {
    ok: false,
    issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  };
}

/**
 * What still has to be filled in before this document can be issued.
 *
 * Separate from the schema on purpose: the composer saves drafts constantly and
 * a half-written power of attorney is a perfectly good draft. This is the check
 * that runs at the moment it stops being a draft.
 */
export function issueBlockers(docType: string, values: Record<string, string>): string[] {
  const entry = catalogueEntry(docType);
  if (!entry) return ["That is not a document type this app knows."];
  return requiredMissing(entry, values).map((f) => f.label);
}

export function issuesToMessage(issues: { path: string; message: string }[]): string {
  if (issues.length === 0) return "That could not be saved.";
  return issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join(". ");
}
