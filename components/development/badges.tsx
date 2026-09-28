"use client";

import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n/language-provider";
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

const RISK_LABEL: Record<RiskLevel, string> = { LOW: "Low risk", MEDIUM: "Medium risk", HIGH: "High risk" };

export function DevStatusBadge({ status }: { status: DevProjectStatus }) {
  const t = useT();
  return <Badge tone={DEV_PROJECT_STATUS_TONE[status]}>{t(DEV_PROJECT_STATUS_LABEL[status])}</Badge>;
}

export function LotStatusBadge({ status }: { status: LotStatus }) {
  const t = useT();
  return <Badge tone={LOT_STATUS_TONE[status]}>{t(LOT_STATUS_LABEL[status])}</Badge>;
}

export function PermitStatusBadge({ status }: { status: PermitTaskStatus }) {
  const t = useT();
  return <Badge tone={PERMIT_TASK_STATUS_TONE[status]}>{t(PERMIT_TASK_STATUS_LABEL[status])}</Badge>;
}

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const t = useT();
  return <Badge tone="blue">{t(LEAD_STATUS_LABEL[status])}</Badge>;
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  const t = useT();
  return <Badge tone={RISK_TONE[level]}>{t(RISK_LABEL[level])}</Badge>;
}
