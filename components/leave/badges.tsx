import { Badge } from "@/components/ui/badge";
import {
  LEAVE_TYPE_LABEL,
  LEAVE_STATUS_LABEL,
  type LeaveType,
  type LeaveStatus,
} from "@/lib/data/leave.types";

type Tone = "neutral" | "blue" | "green" | "amber" | "red" | "violet" | "slate";

const typeTone: Record<LeaveType, Tone> = {
  ANNUAL: "blue",
  SICK: "red",
  UNPAID: "slate",
  MATERNITY: "violet",
  PATERNITY: "violet",
  PUBLIC: "neutral",
};

const statusTone: Record<LeaveStatus, Tone> = {
  PENDING: "amber",
  APPROVED: "green",
  REJECTED: "red",
  CANCELLED: "slate",
};

export function LeaveTypeBadge({ type }: { type: LeaveType }) {
  return <Badge tone={typeTone[type]}>{LEAVE_TYPE_LABEL[type]}</Badge>;
}

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  return <Badge tone={statusTone[status]}>{LEAVE_STATUS_LABEL[status]}</Badge>;
}
