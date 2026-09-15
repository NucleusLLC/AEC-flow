/**
 * Building Permit badges — the module's whole colour vocabulary, in one file.
 *
 * Every one of these wraps the app's existing <Badge>: a new colour system for
 * one module is how two screens in the same product come to disagree about what
 * amber means.
 */
import { Badge } from "@/components/ui/badge";
import { militaryDate } from "@/lib/building-permits/register";
import {
  APPROVAL_STATUS_LABEL,
  APPROVAL_STATUS_TONE,
  CORRESPONDENCE_DIRECTION_LABEL,
  PERMIT_STATUS_LABEL,
  PERMIT_STATUS_TONE,
  PERMIT_TYPE_LABEL,
  type BuildingPermitApprovalStatus,
  type BuildingPermitCorrespondenceDirection,
  type BuildingPermitStatus,
  type BuildingPermitType,
} from "@/lib/building-permits/types";

export function PermitStatusBadge({ status }: { status: BuildingPermitStatus }) {
  return <Badge tone={PERMIT_STATUS_TONE[status]}>{PERMIT_STATUS_LABEL[status]}</Badge>;
}

export function PermitTypeBadge({ type }: { type: BuildingPermitType }) {
  return <Badge tone="neutral">{PERMIT_TYPE_LABEL[type]}</Badge>;
}

export function ApprovalStatusBadge({ status }: { status: BuildingPermitApprovalStatus }) {
  return <Badge tone={APPROVAL_STATUS_TONE[status]}>{APPROVAL_STATUS_LABEL[status]}</Badge>;
}

export function DirectionBadge({
  direction,
}: {
  direction: BuildingPermitCorrespondenceDirection;
}) {
  return (
    <Badge tone={direction === "INCOMING" ? "violet" : "slate"}>
      {CORRESPONDENCE_DIRECTION_LABEL[direction]}
    </Badge>
  );
}

/**
 * The deadline on an unanswered letter. Red once it has passed, amber while it
 * is close, and nothing at all when there is no clock running — a register that
 * shows a badge on every row teaches people to stop reading badges.
 */
export function ResponseDueBadge({
  dueAt,
  today,
  soonDays = 7,
}: {
  dueAt: string | null;
  today: string;
  soonDays?: number;
}) {
  if (!dueAt) return null;
  if (dueAt < today) return <Badge tone="red">Reply overdue · {militaryDate(dueAt)}</Badge>;
  const horizon = new Date(`${today}T00:00:00`);
  horizon.setDate(horizon.getDate() + soonDays);
  const soon = `${horizon.getFullYear()}-${String(horizon.getMonth() + 1).padStart(2, "0")}-${String(
    horizon.getDate(),
  ).padStart(2, "0")}`;
  if (dueAt <= soon) return <Badge tone="amber">Reply due {militaryDate(dueAt)}</Badge>;
  return <Badge tone="neutral">Reply due {militaryDate(dueAt)}</Badge>;
}
