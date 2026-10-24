/**
 * Scheduling data-access. SERVER-ONLY.
 *
 * Every read and write goes through the Prisma tenant extension (Appointment is
 * in TENANT_MODELS), so another practice's diary cannot be read, edited or even
 * found. Single-row reads use `findFirst`, never `findUnique`, for the reason
 * lib/data/general-documents.ts sets out.
 *
 * NAMES ARE RESOLVED HERE, NEVER TAKEN FROM THE CALLER. The project, proposal
 * and client names are read from those records through the tenant-scoped
 * client; a project or proposal id belonging to another practice is simply not
 * found, and the booking is refused. Attendees are users — and `User` is NOT in
 * the tenant extension (lib/server/actor.ts), so every user lookup here carries
 * `companyId` by hand.
 *
 * HOURS GO ON THE TIMESHEETS ONCE. `timeLoggedAt` is claimed with a guarded
 * `updateMany` (… WHERE timeLoggedAt IS NULL) before any entry is written, so
 * two clicks, two tabs or a replayed request cannot log the same visit twice.
 * The entries themselves are written by `logTime` (lib/data/time-entries.ts),
 * which keeps its own rule: logging for somebody else is administrator work.
 *
 * WHAT IS IMMUTABLE. A visit may be edited, postponed or cancelled while it is
 * SCHEDULED or POSTPONED. Once COMPLETED or CANCELLED it is a record of what
 * happened. Only a SCHEDULED visit with nothing on a timesheet may be deleted
 * (soft).
 */
import "server-only";
import { prisma } from "@/lib/db";
import { requireActor, type Actor } from "@/lib/server/actor";
import { canManagePasswords } from "@/lib/password-policy";
import { logTime } from "@/lib/data/time-entries";
import {
  canCancel,
  canComplete,
  canDelete,
  canEdit,
  canPostpone,
  nextAppointmentNumber,
  plannedHours,
  roundHours,
  splitWallClock,
  summarize,
  timesheetBlocker,
  timesheetTargets,
  toWallClockUtc,
  wallClockNow,
  type FieldSummary,
} from "@/lib/scheduling/calc";
import type { ParsedAppointmentInput } from "@/lib/scheduling/schema";
import {
  APPOINTMENT_TYPE_LABEL,
  type AppointmentDTO,
  type AppointmentFilter,
  type AppointmentStatus,
  type AppointmentType,
  type PickerOption,
  type ProposalOption,
  type TimesheetOutcome,
} from "@/lib/scheduling/types";

// ── Errors ─────────────────────────────────────────────────────────────────
// Every message is a plain sentence the person can act on; the actions return
// them as they are.

export class AppointmentNotFoundError extends Error {
  constructor() {
    super("That appointment could not be found.");
    this.name = "AppointmentNotFoundError";
  }
}

export class AppointmentLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppointmentLinkError";
  }
}

export class AppointmentLockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppointmentLockedError";
  }
}

export class AppointmentNumberInUseError extends Error {
  constructor() {
    super("Two appointments were booked at the same moment. Please try again.");
    this.name = "AppointmentNumberInUseError";
  }
}

export const SCHEDULING_ERRORS = [
  AppointmentNotFoundError,
  AppointmentLinkError,
  AppointmentLockedError,
  AppointmentNumberInUseError,
];

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

// ── Conversions ────────────────────────────────────────────────────────────

type DecimalLike = { toNumber(): number } | number | string | null | undefined;

function numOrNull(v: DecimalLike): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : v.toNumber();
  return Number.isFinite(n) ? n : null;
}

type Row = {
  id: string;
  number: string;
  type: AppointmentType;
  status: AppointmentStatus;
  title: string;
  location: string | null;
  notes: string | null;
  outcome: string | null;
  startsAt: Date;
  endsAt: Date;
  actualHours: DecimalLike;
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
  timeLoggedAt: Date | null;
  cancelReason: string | null;
  createdByName: string | null;
  completedByName: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function toDTO(r: Row): AppointmentDTO {
  const start = splitWallClock(r.startsAt);
  return {
    id: r.id,
    number: r.number,
    type: r.type,
    status: r.status,
    title: r.title,
    location: r.location,
    notes: r.notes,
    outcome: r.outcome,
    startsAt: r.startsAt.toISOString(),
    endsAt: r.endsAt.toISOString(),
    date: start.date,
    startTime: start.time,
    endTime: splitWallClock(r.endsAt).time,
    plannedHours: plannedHours(r.startsAt, r.endsAt),
    actualHours: numOrNull(r.actualHours),
    projectId: r.projectId,
    projectName: r.projectName,
    serviceProposalId: r.serviceProposalId,
    proposalNumber: r.proposalNumber,
    proposalTitle: r.proposalTitle,
    clientId: r.clientId,
    clientName: r.clientName,
    attendeeIds: r.attendeeIds ?? [],
    attendeeNames: r.attendeeNames ?? [],
    externalAttendees: r.externalAttendees,
    timeLoggedAt: r.timeLoggedAt?.toISOString() ?? null,
    cancelReason: r.cancelReason,
    createdByName: r.createdByName,
    completedByName: r.completedByName,
    completedAt: r.completedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function ymdToDate(s: string | undefined, endOfDay = false): Date | null {
  if (!s) return null;
  const d = toWallClockUtc(s.slice(0, 10), "00:00");
  if (!d) return null;
  return endOfDay ? new Date(d.getTime() + 86_400_000) : d;
}

/**
 * The office's wall clock now, in the same frame as the stored times. The
 * server runs in UTC; the office does not (lib/data/officedash.ts, same env).
 */
export function officeNow(): Date {
  return wallClockNow(new Date(), process.env.OFFICE_TIME_ZONE || "America/Aruba");
}

// ── Reads ──────────────────────────────────────────────────────────────────

/** Every proposal (deleted ones too) converted into this project. */
async function proposalIdsForProject(projectId: string): Promise<string[]> {
  const rows = await prisma.serviceProposal.findMany({
    where: { projectId },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export async function listAppointments(filter: AppointmentFilter = {}): Promise<AppointmentDTO[]> {
  const and: Record<string, unknown>[] = [{ deletedAt: null }];
  if (filter.projectId) {
    // A visit booked on a proposal that later became this project belongs to
    // the project's history too.
    const viaProposals = await proposalIdsForProject(filter.projectId);
    and.push({
      OR: [
        { projectId: filter.projectId },
        ...(viaProposals.length ? [{ serviceProposalId: { in: viaProposals } }] : []),
      ],
    });
  }
  if (filter.serviceProposalId) and.push({ serviceProposalId: filter.serviceProposalId });
  if (filter.type) and.push({ type: filter.type });
  if (filter.status) and.push({ status: filter.status });
  const from = ymdToDate(filter.from);
  const to = ymdToDate(filter.to, true);
  if (from) and.push({ startsAt: { gte: from } });
  if (to) and.push({ startsAt: { lt: to } });

  const rows = await prisma.appointment.findMany({
    where: { AND: and },
    orderBy: [{ startsAt: "asc" }],
    take: 2000,
  });
  return (rows as Row[]).map(toDTO);
}

export async function getAppointment(id: string): Promise<AppointmentDTO | null> {
  if (typeof id !== "string" || !id) return null;
  const row = await prisma.appointment.findFirst({
    where: { deletedAt: null, OR: [{ id }, { number: id }] },
  });
  return row ? toDTO(row as Row) : null;
}

/** A project's field work: its own visits and those booked on its proposals. */
export async function listAppointmentsForProject(projectId: string): Promise<AppointmentDTO[]> {
  return listAppointments({ projectId });
}

export async function listAppointmentsForProposal(proposalId: string): Promise<AppointmentDTO[]> {
  return listAppointments({ serviceProposalId: proposalId });
}

/** Hours of completed field work, by type, and what is still to come. */
export async function projectFieldSummary(
  projectId: string,
  now: Date,
): Promise<{ summary: FieldSummary; appointments: AppointmentDTO[] }> {
  const appointments = await listAppointmentsForProject(projectId);
  return {
    summary: summarize(
      appointments.map((a) => ({ ...a, actualHours: a.actualHours })),
      now,
    ),
    appointments,
  };
}

/**
 * What the booking form offers: this practice's projects, its live proposals
 * and its active people. Users are scoped by hand (not in the extension).
 */
export async function listSchedulingPickers(): Promise<{
  projects: PickerOption[];
  proposals: ProposalOption[];
  team: PickerOption[];
}> {
  const actor = await requireActor();
  const [projects, proposals, team] = await Promise.all([
    prisma.project.findMany({
      where: { archivedAt: null },
      select: { id: true, name: true, projectNumber: true },
      orderBy: { name: "asc" },
    }),
    prisma.serviceProposal.findMany({
      where: { deletedAt: null },
      select: { id: true, number: true, title: true, clientName: true, projectId: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.user.findMany({
      where: { companyId: actor.companyId, status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return {
    projects: projects.map((p) => ({
      id: p.id,
      name: p.projectNumber ? `${p.projectNumber} · ${p.name}` : p.name,
    })),
    proposals: proposals.map((p) => ({
      id: p.id,
      name: `${p.number} · ${p.title}${p.clientName ? ` · ${p.clientName}` : ""}`,
      projectId: p.projectId,
    })),
    team: team.map((u) => ({ id: u.id, name: u.name })),
  };
}

// ── Resolving links and people ─────────────────────────────────────────────

type Links = {
  projectId: string | null;
  projectName: string | null;
  serviceProposalId: string | null;
  proposalNumber: string | null;
  proposalTitle: string | null;
  clientId: string | null;
  clientName: string | null;
};

/**
 * The project and/or proposal, read inside this practice. A proposal already
 * converted into a project brings that project along when none was chosen, so
 * its hours can reach the timesheets.
 */
async function resolveLinks(projectId: string | null, serviceProposalId: string | null): Promise<Links> {
  const proposal = serviceProposalId
    ? await prisma.serviceProposal.findFirst({
        where: { id: serviceProposalId, deletedAt: null },
        select: { id: true, number: true, title: true, clientId: true, clientName: true, projectId: true },
      })
    : null;
  if (serviceProposalId && !proposal) {
    throw new AppointmentLinkError("That service proposal could not be found.");
  }

  const wantProject = projectId ?? proposal?.projectId ?? null;
  const project = wantProject
    ? await prisma.project.findFirst({
        where: { id: wantProject },
        select: { id: true, name: true, clientId: true, client: { select: { name: true } } },
      })
    : null;
  if (projectId && !project) throw new AppointmentLinkError("That project could not be found.");
  if (!project && !proposal) {
    throw new AppointmentLinkError("Link it to a project or a service proposal.");
  }

  return {
    projectId: project?.id ?? null,
    projectName: project?.name ?? null,
    serviceProposalId: proposal?.id ?? null,
    proposalNumber: proposal?.number ?? null,
    proposalTitle: proposal?.title ?? null,
    clientId: project?.clientId ?? proposal?.clientId ?? null,
    clientName: project?.client?.name ?? proposal?.clientName ?? null,
  };
}

/** Attendees in the order chosen, every one a member of this practice. */
async function resolveAttendees(actor: Actor, ids: string[]): Promise<{ ids: string[]; names: string[] }> {
  if (ids.length === 0) return { ids: [], names: [] };
  const rows = await prisma.user.findMany({
    // User is NOT tenant-scoped by the extension — the company filter is ours
    // to carry. Dropping it would let a booking name another practice's staff.
    where: { companyId: actor.companyId, id: { in: ids } },
    select: { id: true, name: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r.name]));
  if (ids.some((id) => !byId.has(id))) {
    throw new AppointmentLinkError("One of the attendees is not a member of this practice.");
  }
  return { ids, names: ids.map((id) => byId.get(id) as string) };
}

async function requireRow(id: string): Promise<Row> {
  const row = await prisma.appointment.findFirst({ where: { id, deletedAt: null } });
  if (!row) throw new AppointmentNotFoundError();
  return row as Row;
}

/** Every number ever used, soft-deleted included, so one is never reused. */
async function allNumbers(): Promise<string[]> {
  const rows = await prisma.appointment.findMany({ select: { number: true } });
  return rows.map((r) => r.number);
}

function times(input: { date: string; startTime: string; endTime: string }): { startsAt: Date; endsAt: Date } {
  const startsAt = toWallClockUtc(input.date, input.startTime);
  const endsAt = toWallClockUtc(input.date, input.endTime);
  if (!startsAt || !endsAt || endsAt <= startsAt) {
    throw new AppointmentLockedError("The end time must be after the start time.");
  }
  return { startsAt, endsAt };
}

// ── Writes ─────────────────────────────────────────────────────────────────

async function writeData(actor: Actor, input: ParsedAppointmentInput) {
  const [links, people] = await Promise.all([
    resolveLinks(input.projectId, input.serviceProposalId),
    resolveAttendees(actor, input.attendeeIds),
  ]);
  return {
    type: input.type,
    title: input.title,
    location: input.location,
    notes: input.notes,
    ...times(input),
    ...links,
    attendeeIds: people.ids,
    attendeeNames: people.names,
    externalAttendees: input.externalAttendees,
  };
}

export async function createAppointment(input: ParsedAppointmentInput): Promise<AppointmentDTO> {
  const actor = await requireActor();
  const data = await writeData(actor, input);
  // Two attempts: a clash on the number means somebody booked in the same
  // instant, and the second read sees their number.
  for (let attempt = 0; attempt < 2; attempt++) {
    const number = nextAppointmentNumber(await allNumbers(), new Date().getUTCFullYear());
    try {
      const created = await prisma.appointment.create({
        data: { ...data, number, createdById: actor.id, createdByName: actor.name },
      });
      return toDTO(created as Row);
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
    }
  }
  throw new AppointmentNumberInUseError();
}

export async function updateAppointment(id: string, input: ParsedAppointmentInput): Promise<AppointmentDTO> {
  const actor = await requireActor();
  const current = await requireRow(id);
  if (!canEdit(current.status)) {
    throw new AppointmentLockedError("Only a scheduled or postponed appointment can be edited.");
  }
  const data = await writeData(actor, input);
  const updated = await prisma.appointment.update({ where: { id: current.id }, data });
  return toDTO(updated as Row);
}

/**
 * Close a visit off: the hours it really took and what came of it, and — when
 * asked — the hours onto the timesheets of the people who went.
 *
 * Completion and logging are separate steps on purpose: a visit is completed
 * even when its hours cannot be logged (no project yet, or nobody this person
 * may log for), and the reason comes back in `timesheet` / `timesheetNote`.
 */
export async function completeAppointment(
  id: string,
  input: { actualHours: number; outcome: string | null; logToTimesheet: boolean },
): Promise<{ appointment: AppointmentDTO; timesheet: TimesheetOutcome | null; timesheetNote: string | null }> {
  const actor = await requireActor();
  const current = await requireRow(id);
  if (!canComplete(current.status)) {
    throw new AppointmentLockedError("This appointment has already been closed off.");
  }

  // Guarded on status so a second click cannot complete it twice with
  // different figures.
  const done = await prisma.appointment.updateMany({
    where: { id: current.id, deletedAt: null, status: { in: ["SCHEDULED", "POSTPONED"] } },
    data: {
      status: "COMPLETED",
      actualHours: roundHours(input.actualHours),
      outcome: input.outcome,
      completedAt: new Date(),
      completedByName: actor.name,
    },
  });
  if (done.count === 0) throw new AppointmentLockedError("This appointment has already been closed off.");

  let timesheet: TimesheetOutcome | null = null;
  let timesheetNote: string | null = null;
  if (input.logToTimesheet) {
    const r = await logAppointmentTimeAs(actor, current.id);
    timesheet = r.timesheet;
    timesheetNote = r.note;
  }
  const after = await requireRow(current.id);
  return { appointment: toDTO(after), timesheet, timesheetNote };
}

/**
 * Put a completed visit's hours on the timesheets, once. Also offered after
 * completion — a visit booked on a proposal can only be logged once that
 * proposal has become a project.
 */
export async function logAppointmentTime(
  id: string,
): Promise<{ appointment: AppointmentDTO; timesheet: TimesheetOutcome | null; note: string | null }> {
  const actor = await requireActor();
  const r = await logAppointmentTimeAs(actor, id);
  return { appointment: toDTO(await requireRow(id)), ...r };
}

async function logAppointmentTimeAs(
  actor: Actor,
  id: string,
): Promise<{ timesheet: TimesheetOutcome | null; note: string | null }> {
  let row = await requireRow(id);
  if (row.status !== "COMPLETED") {
    throw new AppointmentLockedError("Complete the appointment before putting its hours on the timesheets.");
  }
  // A visit booked on a proposal that has since become a project can now be
  // logged against that project. Read through the tenant-scoped client.
  if (!row.projectId && row.serviceProposalId) {
    const proposal = await prisma.serviceProposal.findFirst({
      where: { id: row.serviceProposalId },
      select: { projectId: true },
    });
    const project = proposal?.projectId
      ? await prisma.project.findFirst({ where: { id: proposal.projectId }, select: { id: true, name: true } })
      : null;
    if (project) {
      await prisma.appointment.update({
        where: { id: row.id },
        data: { projectId: project.id, projectName: project.name },
      });
      row = await requireRow(id);
    }
  }

  const blocker = timesheetBlocker({
    projectId: row.projectId,
    timeLoggedAt: row.timeLoggedAt,
    attendeeIds: row.attendeeIds,
  });
  if (blocker) return { timesheet: null, note: blocker };

  const attendees = row.attendeeIds.map((uid, i) => ({ id: uid, name: row.attendeeNames[i] ?? "" }));
  const { log, skipped } = timesheetTargets(attendees, {
    id: actor.id,
    isApprover: canManagePasswords(actor.role, actor.isFounder),
  });
  if (log.length === 0) {
    return {
      timesheet: { logged: 0, loggedFor: [], skipped: skipped.map((s) => s.name) },
      note: "Only a director or an administrator can log hours for somebody else, and you are not listed as attending. Nothing was put on the timesheets.",
    };
  }

  // Claim first, so nothing can log this visit a second time.
  const claim = await prisma.appointment.updateMany({
    where: { id: row.id, deletedAt: null, timeLoggedAt: null },
    data: { timeLoggedAt: new Date() },
  });
  if (claim.count === 0) return { timesheet: null, note: "These hours are already on the timesheets." };

  const hours = numOrNull(row.actualHours) ?? plannedHours(row.startsAt, row.endsAt);
  const date = splitWallClock(row.startsAt).date;
  const description = `${row.number} · ${APPOINTMENT_TYPE_LABEL[row.type]}: ${row.title}`.slice(0, 500);
  const loggedFor: string[] = [];
  try {
    for (const person of log) {
      await logTime({
        userId: person.id,
        projectId: row.projectId,
        date,
        hours,
        billable: true,
        description,
      });
      loggedFor.push(person.name);
    }
  } catch (e) {
    // Nothing written: release the claim so it can be tried again. Something
    // written: keep it, so what is there is not logged a second time.
    if (loggedFor.length === 0) {
      await prisma.appointment.updateMany({ where: { id: row.id }, data: { timeLoggedAt: null } });
    }
    throw e;
  }

  const timesheet = { logged: loggedFor.length, loggedFor, skipped: skipped.map((s) => s.name) };
  const note =
    skipped.length > 0
      ? `Only your own hours were logged: a director or an administrator logs hours for somebody else (${timesheet.skipped.join(", ")}).`
      : null;
  return { timesheet, note };
}

export async function cancelAppointment(id: string, reason: string): Promise<AppointmentDTO> {
  const current = await requireRow(id);
  if (!canCancel(current.status)) {
    throw new AppointmentLockedError("Only a scheduled or postponed appointment can be cancelled.");
  }
  const updated = await prisma.appointment.update({
    where: { id: current.id },
    data: { status: "CANCELLED", cancelReason: reason },
  });
  return toDTO(updated as Row);
}

/** Move it to a new date and time; it stays marked POSTPONED. */
export async function postponeAppointment(
  id: string,
  input: { date: string; startTime: string; endTime: string; reason: string | null },
): Promise<AppointmentDTO> {
  const current = await requireRow(id);
  if (!canPostpone(current.status)) {
    throw new AppointmentLockedError("Only a scheduled or postponed appointment can be postponed.");
  }
  const updated = await prisma.appointment.update({
    where: { id: current.id },
    data: { status: "POSTPONED", ...times(input), cancelReason: input.reason },
  });
  return toDTO(updated as Row);
}

/** Soft delete, and only while nothing has happened to it. */
export async function deleteAppointment(id: string): Promise<AppointmentDTO> {
  const current = await requireRow(id);
  if (!canDelete({ status: current.status, timeLoggedAt: current.timeLoggedAt })) {
    throw new AppointmentLockedError(
      "Only a scheduled appointment with no hours logged can be deleted. Cancel it instead.",
    );
  }
  const affected = await prisma.appointment.updateMany({
    where: { id: current.id, deletedAt: null, status: "SCHEDULED", timeLoggedAt: null },
    data: { deletedAt: new Date() },
  });
  if (affected.count === 0) throw new AppointmentNotFoundError();
  return toDTO(current);
}
