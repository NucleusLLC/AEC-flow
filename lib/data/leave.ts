/**
 * Leave data-access layer (Prisma-backed — see lib/data/clients.ts for the
 * single-tenant -> SaaS hedge rationale).
 */

import { prisma } from "@/lib/db";
import { TODAY, isOut } from "./leave.types";
import type {
  LeaveRequest,
  LeaveStatus,
  LeaveType,
  LeaveWriteInput,
  PublicHoliday,
  WhoIsOut,
} from "./leave.types";

export * from "./leave.types";

// DateTime -> "YYYY-MM-DD" (dates are stored at UTC midnight by the seed).
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function getLeaveRequests(): Promise<LeaveRequest[]> {
  const rows = await prisma.leaveRequest.findMany({
    include: { user: true },
    orderBy: { startDate: "desc" },
  });
  const requests: LeaveRequest[] = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    userName: r.user.name,
    type: r.type,
    status: r.status,
    startDate: ymd(r.startDate),
    endDate: ymd(r.endDate),
    days: r.days,
    reason: r.reason,
    approvedBy: r.approvedBy,
  }));
  const statusOrder: Record<LeaveStatus, number> = {
    PENDING: 0,
    APPROVED: 1,
    REJECTED: 2,
    CANCELLED: 3,
  };
  return requests.sort((a, b) => {
    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return statusOrder[a.status] - statusOrder[b.status];
    }
    return a.startDate.localeCompare(b.startDate);
  });
}

/** Single leave request by id (mapped exactly like getLeaveRequests). */
export async function getLeaveRequest(id: string): Promise<LeaveRequest | null> {
  const r = await prisma.leaveRequest.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!r) return null;
  return {
    id: r.id,
    userId: r.userId,
    userName: r.user.name,
    type: r.type,
    status: r.status,
    startDate: ymd(r.startDate),
    endDate: ymd(r.endDate),
    days: r.days,
    reason: r.reason,
    approvedBy: r.approvedBy,
  };
}

export async function getWhoIsOut(): Promise<WhoIsOut[]> {
  const rows = await prisma.leaveRequest.findMany({
    where: { status: "APPROVED" },
    include: { user: true },
  });
  return rows
    .map((r) => ({
      id: r.id,
      name: r.user.name,
      type: r.type,
      status: r.status,
      startDate: ymd(r.startDate),
      endDate: ymd(r.endDate),
    }))
    .filter((r) => isOut(r, TODAY))
    .map((r) => ({ id: r.id, name: r.name, type: r.type, until: r.endDate }))
    .sort((a, b) => a.until.localeCompare(b.until));
}

export async function getUpcomingHolidays(): Promise<PublicHoliday[]> {
  const rows = await prisma.publicHoliday.findMany({ orderBy: { date: "asc" } });
  return rows
    .map((h) => ({ id: h.id, name: h.name, date: ymd(h.date), isCompany: h.isCompany }))
    .filter((h) => h.date >= TODAY)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

export type LeaveInput = {
  /** Team member NAME (e.g. "Greg Lacle"); resolved to User.id below. */
  userName: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days?: number | null;
  reason?: string | null;
  status?: LeaveStatus;
};

/** Inclusive calendar-day count between two dates. */
function inclusiveDays(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / 86_400_000) + 1;
}

export async function createLeave(input: LeaveInput): Promise<{ id: string }> {
  const user = await prisma.user.findFirst({ where: { name: input.userName } });
  if (!user) throw new Error(`Unknown team member: ${input.userName}`);

  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);
  const days =
    input.days != null && input.days > 0 ? input.days : inclusiveDays(startDate, endDate);

  const r = await prisma.leaveRequest.create({
    data: {
      userId: user.id,
      type: input.type,
      startDate,
      endDate,
      days,
      reason: input.reason ?? null,
      status: input.status ?? "PENDING",
    },
  });
  return { id: r.id };
}

/* ------------------------------------------------------------------ */
/* Form mutations (mirror lib/data/proposals.ts create/update)        */
/* ------------------------------------------------------------------ */

/**
 * Resolve a team member's display name to a User.id. Falls back to a senior
 * user (lowest UserRole — ADMIN sorts first) so a write never fails on an
 * unmatched name. Mirrors resolveOwnerId() in lib/data/proposals.ts.
 */
async function resolveLeaveUserId(name: string): Promise<string> {
  const byName = await prisma.user.findFirst({ where: { name }, select: { id: true } });
  if (byName) return byName.id;
  const fallback = await prisma.user.findFirst({
    orderBy: { role: "asc" },
    select: { id: true },
  });
  if (!fallback) throw new Error("No users exist to assign the leave request to.");
  return fallback.id;
}

function leaveScalarData(input: LeaveWriteInput, userId: string) {
  return {
    userId,
    type: input.type,
    status: input.status,
    startDate: new Date(input.startDate),
    endDate: new Date(input.endDate),
    days: input.days,
    reason: input.reason.trim() === "" ? null : input.reason,
  };
}

/** Create a leave request from the form payload. Returns the new id. */
export async function createLeaveRequest(input: LeaveWriteInput): Promise<string> {
  const userId = await resolveLeaveUserId(input.userName);
  const r = await prisma.leaveRequest.create({ data: leaveScalarData(input, userId) });
  return r.id;
}

/** Update an existing leave request (no child rows — a plain update). Returns the id. */
export async function updateLeaveRequest(input: LeaveWriteInput): Promise<string> {
  if (!input.id) throw new Error("Leave request id is required for update.");
  const userId = await resolveLeaveUserId(input.userName);
  await prisma.leaveRequest.update({
    where: { id: input.id },
    data: leaveScalarData(input, userId),
  });
  return input.id;
}
