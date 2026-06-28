import { Badge } from "@/components/ui/badge";
import {
  DEV_PROJECT_STATUS_LABEL,
  DEV_PROJECT_STATUS_TONE,
  LOT_STATUS_LABEL,
  LOT_STATUS_TONE,
  PERMIT_TASK_STATUS_LABEL,
  PERMIT_TASK_STATUS_TONE,
  LEAD_STATUS_LABEL,
  RISK_TONE,
  type DevProjectStatus,
  type LotStatus,
  type PermitTaskStatus,
  type LeadStatus,
  type RiskLevel,
} from "@/lib/data/development.types";

export function DevStatusBadge({ status }: { status: DevProjectStatus }) {
  return <Badge tone={DEV_PROJECT_STATUS_TONE[status]}>{DEV_PROJECT_STATUS_LABEL[status]}</Badge>;
}

export function LotStatusBadge({ status }: { status: LotStatus }) {
  return <Badge tone={LOT_STATUS_TONE[status]}>{LOT_STATUS_LABEL[status]}</Badge>;
}

export function PermitStatusBadge({ status }: { status: PermitTaskStatus }) {
  return <Badge tone={PERMIT_TASK_STATUS_TONE[status]}>{PERMIT_TASK_STATUS_LABEL[status]}</Badge>;
}

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <Badge tone="blue">{LEAD_STATUS_LABEL[status]}</Badge>;
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  return <Badge tone={RISK_TONE[level]}>{level.charAt(0) + level.slice(1).toLowerCase()} risk</Badge>;
}
