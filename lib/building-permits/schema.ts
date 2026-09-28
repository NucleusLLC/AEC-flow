/**
 * Building Permit input validation.
 *
 * The AUTHORITATIVE gate. Every server action parses its payload through these
 * schemas before the data layer sees it — a server action is a public endpoint,
 * and the browser form is a convenience, not a control.
 *
 * PURE: zod only, no Prisma, no session. Safe to import from a test.
 */
import { z } from "zod";
import {
  APPROVAL_STAGES,
  APPROVAL_STATUSES,
  CORRESPONDENCE_DIRECTIONS,
  DOCUMENT_CATEGORIES,
  PERMIT_STATUSES,
  PERMIT_TYPES,
  SUBMISSION_METHODS,
} from "./types";

/** A calendar date as the browser's `<input type="date">` produces it. */
const dateOnly = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date in the form YYYY-MM-DD")
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00`)), "That is not a real date");

/** An optional date: an empty field means "not known yet", not "invalid". */
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

const optionalMoney = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  })
  .refine((v) => v === null || v >= 0, "Cannot be negative");

const enumOf = <T extends string>(values: readonly T[], label: string) =>
  z.string().refine((v): v is T => (values as readonly string[]).includes(v), {
    message: `Not a ${label} this app knows`,
  }) as unknown as z.ZodType<T>;

export const buildingPermitInputSchema = z
  .object({
    // Blank is legal and means "assign the next reference in the sequence".
    reference: z
      .union([z.string().max(40), z.null()])
      .optional()
      .transform((v) => {
        const t = typeof v === "string" ? v.trim() : v;
        return t === "" || t === undefined ? undefined : (t ?? undefined);
      }),
    permitNumber: optionalText(60, "The permit number"),
    title: z.string().trim().min(1, "Give the permit a title").max(200),
    permitType: enumOf(PERMIT_TYPES, "permit type"),
    status: enumOf(PERMIT_STATUSES, "status"),
    description: optionalText(4000, "The description"),

    projectId: optionalText(60),
    projectName: optionalText(200),
    clientId: optionalText(60),
    clientName: optionalText(200),

    applicantName: optionalText(200),
    siteAddress: optionalText(300),
    parcelNumber: optionalText(80),
    landRegistry: optionalText(120),

    authority: optionalText(160),
    authorityContact: optionalText(160),
    authorityEmail: z
      .union([z.string().trim().email("That is not an email address"), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : (v ?? null))),

    lotAreaM2: optionalMoney,
    builtAreaM2: optionalMoney,
    estimatedValue: optionalMoney,
    currency: z.string().trim().length(3, "Use a 3-letter currency code").optional(),

    submittedAt: optionalDate,
    acknowledgedAt: optionalDate,
    conceptApprovalAt: optionalDate,
    conceptApprovalRef: optionalText(60),
    decisionAt: optionalDate,
    issuedAt: optionalDate,
    expiresAt: optionalDate,
    targetDecisionAt: optionalDate,

    feeAmount: optionalMoney,
    feePaidAt: optionalDate,

    responsibleId: optionalText(60),
    responsibleName: optionalText(160),
    notes: optionalText(4000, "The notes"),
  })
  // Dates that contradict each other are the single most common way a permit
  // register stops being trusted, so they are refused at the gate rather than
  // stored and explained later.
  .refine((v) => !(v.acknowledgedAt && v.submittedAt) || v.acknowledgedAt >= v.submittedAt, {
    message: "The authority cannot acknowledge a submission before it was submitted",
    path: ["acknowledgedAt"],
  })
  .refine((v) => !(v.decisionAt && v.submittedAt) || v.decisionAt >= v.submittedAt, {
    message: "A decision cannot predate the submission",
    path: ["decisionAt"],
  })
  .refine((v) => !(v.expiresAt && v.issuedAt) || v.expiresAt >= v.issuedAt, {
    message: "A permit cannot expire before it was issued",
    path: ["expiresAt"],
  })
  // A status that claims more than the dates do is the other way. Concept
  // approval and issue are the two the office reads off the register at a
  // glance, so those two are held to their dates.
  .refine((v) => v.status !== "CONCEPT_APPROVED" || Boolean(v.conceptApprovalAt), {
    message: "Record the concept approval date before setting this status",
    path: ["conceptApprovalAt"],
  })
  .refine((v) => v.status !== "ISSUED" || Boolean(v.issuedAt), {
    message: "Record the date the permit was issued before setting this status",
    path: ["issuedAt"],
  });

export const submissionInputSchema = z.object({
  submittedAt: dateOnly,
  method: enumOf(SUBMISSION_METHODS, "submission method"),
  receivedBy: optionalText(160),
  receiptNumber: optionalText(80),
  contents: optionalText(4000, "The contents"),
  notes: optionalText(2000, "The notes"),
});

export const meetingInputSchema = z.object({
  heldAt: dateOnly,
  subject: z.string().trim().min(1, "Give the meeting a subject").max(200),
  location: optionalText(200),
  attendees: optionalText(1000),
  minutes: optionalText(20000, "The minutes"),
  decisions: optionalText(4000, "The decisions"),
  followUp: optionalText(4000, "The follow-up"),
});

export const correspondenceInputSchema = z
  .object({
    direction: enumOf(CORRESPONDENCE_DIRECTIONS, "direction"),
    letterRef: optionalText(80),
    party: optionalText(200),
    subject: z.string().trim().min(1, "Give the letter a subject").max(200),
    letterDate: optionalDate,
    receivedAt: optionalDate,
    summary: optionalText(8000, "The summary"),
    requiresResponse: z.boolean(),
    responseDueAt: optionalDate,
    respondedAt: optionalDate,
  })
  .refine((v) => !v.responseDueAt || v.requiresResponse, {
    message: "A response deadline only makes sense on a letter that needs an answer",
    path: ["responseDueAt"],
  })
  .refine((v) => !(v.respondedAt && v.letterDate) || v.respondedAt >= v.letterDate, {
    message: "The reply cannot predate the letter",
    path: ["respondedAt"],
  });

export const approvalInputSchema = z
  .object({
    stage: enumOf(APPROVAL_STAGES, "stage"),
    status: enumOf(APPROVAL_STATUSES, "status"),
    decidedAt: optionalDate,
    refNumber: optionalText(80),
    validUntil: optionalDate,
    conditions: optionalText(8000, "The conditions"),
    notes: optionalText(4000, "The notes"),
  })
  .refine((v) => v.status === "PENDING" || Boolean(v.decidedAt), {
    message: "A decided approval needs the date it was decided",
    path: ["decidedAt"],
  });

export const documentInputSchema = z
  .object({
    name: z.string().trim().min(1, "Give the document a name").max(200),
    category: enumOf(DOCUMENT_CATEGORIES, "category"),
    storageKey: optionalText(500),
    externalUrl: optionalText(1000),
    filename: optionalText(255),
    mimeType: optionalText(150),
    sizeBytes: z
      .union([z.number().int().nonnegative(), z.null()])
      .optional()
      .transform((v) => v ?? null),
    documentDate: optionalDate,
    notes: optionalText(2000, "The notes"),
  })
  // A document row that points at nothing is a row someone will click on and
  // find empty, which is worse than not having recorded it.
  .refine((v) => Boolean(v.storageKey) || Boolean(v.externalUrl), {
    message: "Attach a file or give a link",
    path: ["storageKey"],
  });

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: { path: string; message: string }[] };

type SafeParse<T> = { success: true; data: T } | { success: false; error: z.ZodError };

function toResult<T>(result: SafeParse<T>): ParseResult<T> {
  if (result.success) return { ok: true, value: result.data };
  return {
    ok: false,
    issues: result.error.issues.map((i: z.core.$ZodIssue) => ({
      path: i.path.join("."),
      message: i.message,
    })),
  };
}

export function parseBuildingPermitInput(data: unknown) {
  return toResult(buildingPermitInputSchema.safeParse(data));
}
export function parseSubmissionInput(data: unknown) {
  return toResult(submissionInputSchema.safeParse(data));
}
export function parseMeetingInput(data: unknown) {
  return toResult(meetingInputSchema.safeParse(data));
}
export function parseCorrespondenceInput(data: unknown) {
  return toResult(correspondenceInputSchema.safeParse(data));
}
export function parseApprovalInput(data: unknown) {
  return toResult(approvalInputSchema.safeParse(data));
}
export function parseDocumentInput(data: unknown) {
  return toResult(documentInputSchema.safeParse(data));
}

/** One line a form can show above the fields. */
export function issuesToMessage(issues: { path: string; message: string }[]): string {
  return issues.map((i) => i.message).join(" ");
}
