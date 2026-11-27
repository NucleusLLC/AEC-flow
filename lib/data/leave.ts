/**
 * Leave data-access layer (Prisma-backed — see lib/data/clients.ts for the
 * single-tenant -> SaaS hedge rationale).
 */

import { prisma } from "@/lib/db";
import { getCurrentCompanyId } from "@/lib/server/tenant";
import { ActorError, requireActor, type Actor } from "@/lib/server/actor";
import { checkLeaveWrite, type LeaveSnapshot } from "@/lib/permissions/role-gates";
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
  const companyId = await getCurrentCompanyId();
  const user = await prisma.user.findFirst({ where: { name: input.userName, companyId } });
  if (!user) throw new Error(`Unknown team member: ${input.userName}`);

  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);
  const days =
    input.days != null && input.days > 0 ? input.days : inclusiveDays(startDate, endDate);
  const status = input.status ?? "PENDING";
  const who = await guardLeaveWrite(null, {
    userId: user.id,
    status,
    type: input.type,
    startDate: ymd(startDate),
    endDate: ymd(endDate),
    days,
  });

  const r = await prisma.leaveRequest.create({
    data: {
      userId: user.id,
      type: input.type,
      startDate,
      endDate,
      days,
      reason: input.reason ?? null,
      status,
      ...decisionStamp(null, status, who),
    },
  });
  return { id: r.id };
}

/* ------------------------------------------------------------------ */
/* Who may write leave (security audit D-6)                            */
/* ------------------------------------------------------------------ */

/**
 * Enforce `checkLeaveWrite` (lib/permissions/role-gates.ts): a VIEWER writes no
 * leave; approving or rejecting is Director / Admin / founder only; and nobody
 * decides their OWN request, not even a Director. The actor comes from their own
 * database row, never from the browser. Returns the actor for the stamp below.
 */
async function guardLeaveWrite(before: LeaveSnapshot | null, after: LeaveSnapshot): Promise<Actor> {
  const who = await requireActor();
  const decision = checkLeaveWrite(who, before, after);
  if (!decision.ok) throw new ActorError(decision.error);
  return who;
}

/** Who decided, and when — set when a request moves into APPROVED or REJECTED. */
function decisionStamp(
  previousStatus: string | null,
  status: string,
  who: Actor,
): { approvedBy?: string; approvedAt?: Date } {
  if (status === previousStatus) return {};
  if (status !== "APPROVED" && status !== "REJECTED") return {};
  return { approvedBy: who.name, approvedAt: new Date() };
}

function snapshotOf(input: LeaveWriteInput, userId: string): LeaveSnapshot {
  return {
    userId,
    status: input.status,
    type: input.type,
    startDate: ymd(new Date(input.startDate)),
    endDate: ymd(new Date(input.endDate)),
    days: input.days,
  };
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
  const companyId = await getCurrentCompanyId();
  const byName = await prisma.user.findFirst({ where: { name, companyId }, select: { id: true } });
  if (byName) return byName.id;
  const fallback = await prisma.user.findFirst({
    where: { companyId },
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
  const who = await guardLeaveWrite(null, snapshotOf(input, userId));
  const r = await prisma.leaveRequest.create({
    data: { ...leaveScalarData(input, userId), ...decisionStamp(null, input.status, who) },
  });
  return r.id;
}

/** Update an existing leave request (no child rows — a plain update). Returns the id. */
export async function updateLeaveRequest(input: LeaveWriteInput): Promise<string> {
  if (!input.id) throw new Error("Leave request id is required for update.");
  const userId = await resolveLeaveUserId(input.userName);
  const current = await getLeaveRequest(input.id);
  if (!current) throw new Error("That leave request could not be found.");
  const who = await guardLeaveWrite(
    {
      userId: current.userId,
      status: current.status,
      type: current.type,
      startDate: current.startDate,
      endDate: current.endDate,
      days: current.days,
    },
    snapshotOf(input, userId),
  );
  await prisma.leaveRequest.update({
    where: { id: input.id },
    data: { ...leaveScalarData(input, userId), ...decisionStamp(current.status, input.status, who) },
  });
  return input.id;
}
