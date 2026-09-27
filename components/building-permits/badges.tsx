/**
 * Building Permit badges — the module's whole colour vocabulary, in one file.
 *
 * Every one of these wraps the app's existing <Badge>: a new colour system for
 * one module is how two screens in the same product come to disagree about what
 * amber means.
 */
"use client";

import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n/language-provider";
import { fmt } from "@/lib/i18n/format";
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
  const t = useT();
  return <Badge tone={PERMIT_STATUS_TONE[status]}>{t(PERMIT_STATUS_LABEL[status])}</Badge>;
}

export function PermitTypeBadge({ type }: { type: BuildingPermitType }) {
  const t = useT();
  return <Badge tone="neutral">{t(PERMIT_TYPE_LABEL[type])}</Badge>;
}

export function ApprovalStatusBadge({ status }: { status: BuildingPermitApprovalStatus }) {
  const t = useT();
  return <Badge tone={APPROVAL_STATUS_TONE[status]}>{t(APPROVAL_STATUS_LABEL[status])}</Badge>;
}

export function DirectionBadge({
  direction,
}: {
  direction: BuildingPermitCorrespondenceDirection;
}) {
  const t = useT();
  return (
    <Badge tone={direction === "INCOMING" ? "violet" : "slate"}>
      {t(CORRESPONDENCE_DIRECTION_LABEL[direction])}
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
  const t = useT();
  if (!dueAt) return null;
  if (dueAt < today) return <Badge tone="red">{fmt(t("Reply overdue · {date}"), { date: militaryDate(dueAt) })}</Badge>;
  const horizon = new Date(`${today}T00:00:00`);
  horizon.setDate(horizon.getDate() + soonDays);
  const soon = `${horizon.getFullYear()}-${String(horizon.getMonth() + 1).padStart(2, "0")}-${String(
    horizon.getDate(),
  ).padStart(2, "0")}`;
  if (dueAt <= soon) return <Badge tone="amber">{fmt(t("Reply due {date}"), { date: militaryDate(dueAt) })}</Badge>;
  return <Badge tone="neutral">{fmt(t("Reply due {date}"), { date: militaryDate(dueAt) })}</Badge>;
}
