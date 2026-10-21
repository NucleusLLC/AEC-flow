/**
 * The zod gate for scheduling. PURE.
 *
 * Every server action re-parses here before the data layer sees anything: an
 * action is a public endpoint and the booking form in front of it is a
 * convenience. Names (project, proposal, client, attendees) are NOT accepted
 * from the caller at all — only ids, which the data layer resolves inside the
 * practice.
 */
import { z } from "zod";
import { APPOINTMENT_TYPES, type AppointmentType } from "./types";
import { toWallClockUtc } from "./calc";

const dateOnly = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date in the form YYYY-MM-DD")
  .refine((s) => toWallClockUtc(s, "00:00") !== null, "That is not a real date");

const time = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time in the form HH:MM (24-hour)");

const optionalText = (max: number, label = "This") =>
  z
    .union([z.string().max(max, `${label} is too long (max ${max} characters)`), z.null()])
    .optional()
    .transform((v) => {
      const t = typeof v === "string" ? v.trim() : v;
      return t === "" || t === undefined ? null : (t ?? null);
    });

const optionalId = z
  .union([z.string().max(120), z.null()])
  .optional()
  .transform((v) => (typeof v === "string" && v.trim() ? v.trim() : null));

/** A visit is one sitting: start and end on the same day, end after start. */
function endAfterStart(v: { date: string; startTime: string; endTime: string }): boolean {
  const s = toWallClockUtc(v.date, v.startTime);
  const e = toWallClockUtc(v.date, v.endTime);
  return Boolean(s && e && e.getTime() > s.getTime());
}

export const appointmentInputSchema = z
  .object({
    type: z.enum(APPOINTMENT_TYPES as [AppointmentType, ...AppointmentType[]], {
      message: "Choose what kind of appointment this is",
    }),
    title: z
      .string()
      .trim()
      .min(1, "Give the appointment a title")
      .max(200, "The title is too long (max 200 characters)"),
    location: optionalText(300, "The location"),
    notes: optionalText(4000, "The agenda"),
    date: dateOnly,
    startTime: time,
    endTime: time,
    projectId: optionalId,
    serviceProposalId: optionalId,
    attendeeIds: z
      .array(z.string().trim().min(1).max(120))
      .max(50, "That is too many attendees (max 50)")
      .optional()
      .transform((ids) => [...new Set(ids ?? [])]),
    externalAttendees: optionalText(1000, "The other attendees"),
  })
  .refine((v) => Boolean(v.projectId || v.serviceProposalId), {
    message: "Link it to a project or a service proposal",
    path: ["projectId"],
  })
  .refine(endAfterStart, {
    message: "The end time must be after the start time",
    path: ["endTime"],
  });

export type ParsedAppointmentInput = z.infer<typeof appointmentInputSchema>;

export const completeInputSchema = z.object({
  actualHours: z.coerce
    .number({ message: "Enter the hours the visit took" })
    .refine((n) => Number.isFinite(n), "Enter the hours the visit took")
    .refine((n) => n > 0, "The hours must be more than zero")
    .refine((n) => n <= 24, "A visit cannot take more than 24 hours"),
  outcome: optionalText(4000, "The outcome"),
  logToTimesheet: z.boolean().optional().default(false),
});

export const cancelInputSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Say why it is cancelled")
    .max(500, "The reason is too long (max 500 characters)"),
});

export const postponeInputSchema = z
  .object({
    date: dateOnly,
    startTime: time,
    endTime: time,
    reason: optionalText(500, "The reason"),
  })
  .refine(endAfterStart, {
    message: "The end time must be after the start time",
    path: ["endTime"],
  });

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: { path: string; message: string }[] };

function parseWith<S extends z.ZodTypeAny>(schema: S, data: unknown): ParseResult<z.infer<S>> {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, value: result.data };
  return {
    ok: false,
    issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  };
}

export const parseAppointmentInput = (data: unknown) => parseWith(appointmentInputSchema, data);
export const parseCompleteInput = (data: unknown) => parseWith(completeInputSchema, data);
export const parseCancelInput = (data: unknown) => parseWith(cancelInputSchema, data);
export const parsePostponeInput = (data: unknown) => parseWith(postponeInputSchema, data);

/** The first problem, as one sentence the form can show. */
export function firstIssue(issues: { path: string; message: string }[]): string {
  return issues[0]?.message ?? "That could not be saved.";
}
