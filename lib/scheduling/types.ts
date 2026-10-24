/**
 * Scheduling — client-safe types and label tables.
 *
 * CLIENT-SAFE. No Prisma import, no "server-only": the booking form and the
 * detail actions are client components. The unions mirror the schema's enums
 * and lib/scheduling/schema.test.ts fails the build if they drift.
 *
 * WHAT THIS MODULE IS. A diary of the practice's field work and meetings — an
 * inspection, a measuring visit, a supervision round, a client meeting — each
 * one booked for a Project or for a potential project (a Service Proposal), so
 * that opening the project shows what visits happened and how many hours they
 * took.
 *
 * TIMES ARE WALL-CLOCK, STORED AS UTC. "09:00" typed on the form is stored as
 * 09:00Z and always read back with UTC accessors (lib/scheduling/calc.ts). See
 * the model comment in prisma/schema.prisma.
 */

export type AppointmentType =
  | "MEETING"
  | "INSPECTION"
  | "MEASURING"
  | "SUPERVISION"
  | "SITE_VISIT"
  | "OTHER";

export type AppointmentStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED" | "POSTPONED";

/** In the order the booking form offers them. */
export const APPOINTMENT_TYPES: AppointmentType[] = [
  "MEETING",
  "INSPECTION",
  "MEASURING",
  "SUPERVISION",
  "SITE_VISIT",
  "OTHER",
];

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "SCHEDULED",
  "COMPLETED",
  "CANCELLED",
  "POSTPONED",
];

/** English display labels — also the i18n keys. */
export const APPOINTMENT_TYPE_LABEL: Record<AppointmentType, string> = {
  MEETING: "Meeting",
  INSPECTION: "Inspection",
  MEASURING: "Measuring",
  SUPERVISION: "Supervision",
  SITE_VISIT: "Site visit",
  OTHER: "Other",
};

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  POSTPONED: "Postponed",
};

export type BadgeTone = "neutral" | "blue" | "green" | "amber" | "red" | "violet" | "slate";

export const APPOINTMENT_STATUS_TONE: Record<AppointmentStatus, BadgeTone> = {
  SCHEDULED: "blue",
  COMPLETED: "green",
  CANCELLED: "slate",
  POSTPONED: "amber",
};

export const APPOINTMENT_TYPE_TONE: Record<AppointmentType, BadgeTone> = {
  MEETING: "violet",
  INSPECTION: "red",
  MEASURING: "blue",
  SUPERVISION: "amber",
  SITE_VISIT: "green",
  OTHER: "neutral",
};

/** One appointment as every screen reads it. Dates are ISO strings. */
export type AppointmentDTO = {
  id: string;
  number: string;
  type: AppointmentType;
  status: AppointmentStatus;
  title: string;
  location: string | null;
  notes: string | null;
  outcome: string | null;
  /** ISO timestamps; the wall-clock time is the UTC time. */
  startsAt: string;
  endsAt: string;
  /** `YYYY-MM-DD`, `HH:MM`, `HH:MM` — the form's own fields. */
  date: string;
  startTime: string;
  endTime: string;
  plannedHours: number;
  actualHours: number | null;
  projectId: string | null;
  projectName: string | null;
  serviceProposalId: string | null;
  proposalNumber: string | null;
  proposalTitle: string | null;
  clientId: string | null;
  clientName: string | null;
  attendeeIds: string[];
  attendeeNames: string[];
  externalAttendees: string | null;
  timeLoggedAt: string | null;
  cancelReason: string | null;
  createdByName: string | null;
  completedByName: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** What the booking form sends. Names are never taken from here. */
export type AppointmentInput = {
  type: AppointmentType;
  title: string;
  location?: string | null;
  notes?: string | null;
  /** `YYYY-MM-DD` */
  date: string;
  /** `HH:MM`, 24-hour */
  startTime: string;
  endTime: string;
  projectId?: string | null;
  serviceProposalId?: string | null;
  attendeeIds?: string[];
  externalAttendees?: string | null;
};

export type CompleteAppointmentInput = {
  actualHours: number | string;
  outcome?: string | null;
  /** Put the hours on each internal attendee's timesheet as a DRAFT entry. */
  logToTimesheet?: boolean;
};

export type PostponeAppointmentInput = {
  date: string;
  startTime: string;
  endTime: string;
  reason?: string | null;
};

export type AppointmentFilter = {
  /** Includes visits booked on proposals later converted to this project. */
  projectId?: string;
  serviceProposalId?: string;
  /** `YYYY-MM-DD`, inclusive. */
  from?: string;
  to?: string;
  type?: AppointmentType;
  status?: AppointmentStatus;
};

/** What the timesheet step did, said back to the person who pressed it. */
export type TimesheetOutcome = {
  logged: number;
  loggedFor: string[];
  /** Attendees whose hours this person may not log (not an administrator). */
  skipped: string[];
};

export type PickerOption = { id: string; name: string };
export type ProposalOption = PickerOption & { projectId: string | null };
