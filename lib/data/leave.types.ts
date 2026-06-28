/**
 * Client-safe leave declarations (types, label maps, pure helpers).
 *
 * This module MUST NOT import "@/lib/db" (or anything that drags the Postgres
 * driver into the browser bundle) so that "use client" components can import
 * leave types/labels without pulling Prisma client-side.
 */

export type LeaveType = "ANNUAL" | "SICK" | "UNPAID" | "MATERNITY" | "PATERNITY" | "PUBLIC";
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export type LeaveRequest = {
  id: string;
  userId: string;
  userName: string;
  type: LeaveType;
  status: LeaveStatus;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  approvedBy: string | null;
};

export type PublicHoliday = {
  id: string;
  name: string;
  date: string;
  isCompany: boolean;
};

export type WhoIsOut = {
  id: string;
  name: string;
  type: LeaveType;
  until: string;
};

export type LeaveSummary = {
  pendingCount: number;
  outTodayCount: number;
  upcomingApprovedCount: number;
  daysThisMonth: number;
  nextHoliday: PublicHoliday | null;
};

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  ANNUAL: "Annual",
  SICK: "Sick",
  UNPAID: "Unpaid",
  MATERNITY: "Maternity",
  PATERNITY: "Paternity",
  PUBLIC: "Public",
};

export const LEAVE_STATUS_LABEL: Record<LeaveStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

// Reference "today" kept stable for placeholder data.
export const TODAY = "2026-06-18";

export function isOut(
  r: Pick<LeaveRequest, "status" | "startDate" | "endDate">,
  today: string,
): boolean {
  return r.status === "APPROVED" && r.startDate <= today && r.endDate >= today;
}

/**
 * Payload the leave request create/edit form submits. `userName` is the team
 * member's display name (resolved to a userId server-side); `id` is present only
 * on edit. Client-safe (no Prisma types) so the `"use client"` form can import it.
 */
export type LeaveWriteInput = {
  /** Present on edit; identifies the row to update. */
  id?: string;
  /** Team member NAME (e.g. "Greg Lacle"); resolved to a User.id server-side. */
  userName: string;
  type: LeaveType;
  status: LeaveStatus;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
};

export function summarizeLeave(
  requests: LeaveRequest[],
  holidays: PublicHoliday[],
): LeaveSummary {
  const month = TODAY.slice(0, 7);
  return {
    pendingCount: requests.filter((r) => r.status === "PENDING").length,
    outTodayCount: requests.filter((r) => isOut(r, TODAY)).length,
    upcomingApprovedCount: requests.filter(
      (r) => r.status === "APPROVED" && r.startDate > TODAY,
    ).length,
    daysThisMonth: requests
      .filter((r) => r.status === "APPROVED" && r.startDate.slice(0, 7) === month)
      .reduce((n, r) => n + r.days, 0),
    nextHoliday: holidays.length > 0 ? holidays[0] : null,
  };
}
