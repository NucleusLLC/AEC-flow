"use client";

import { useT } from "@/components/i18n/language-provider";
import { Badge } from "@/components/ui/badge";
import {
  CHANGE_ORDER_STATUS_LABEL,
  CHANGE_ORDER_STATUS_TONE,
  RFI_STATUS_LABEL,
  RFI_STATUS_TONE,
  RFI_PRIORITY_LABEL,
  RFI_PRIORITY_TONE,
  CA_REPORT_STATUS_LABEL,
  CA_REPORT_STATUS_TONE,
  CERT_STATUS_LABEL,
  CERT_STATUS_TONE,
  PUNCH_STATUS_LABEL,
  PUNCH_STATUS_TONE,
  SITE_INSTRUCTION_STATUS_LABEL,
  SITE_INSTRUCTION_STATUS_TONE,
  SUBMITTAL_STATUS_LABEL,
  SUBMITTAL_STATUS_TONE,
  DELAY_STATUS_LABEL,
  DELAY_STATUS_TONE,
  IMPACT_LEVEL_LABEL,
  IMPACT_LEVEL_TONE,
  DISCIPLINE_LABEL,
  tCa,
} from "@/lib/ca/labels";
import type {
  ChangeOrderStatus,
  RfiStatus,
  RfiPriority,
  CaReportStatus,
  CertificationStatus,
  PunchStatus,
  SiteInstructionStatus,
  SubmittalStatus,
  DelayStatus,
  ImpactLevel,
  CaDiscipline,
} from "@/lib/ca/types";

export function ChangeOrderStatusBadge({ status }: { status: ChangeOrderStatus }) {
  const t = useT();
  return <Badge tone={CHANGE_ORDER_STATUS_TONE[status]}>{tCa(t, CHANGE_ORDER_STATUS_LABEL[status])}</Badge>;
}

export function RfiStatusBadge({ status }: { status: RfiStatus }) {
  const t = useT();
  return <Badge tone={RFI_STATUS_TONE[status]}>{tCa(t, RFI_STATUS_LABEL[status])}</Badge>;
}

export function RfiPriorityBadge({ priority }: { priority: RfiPriority }) {
  const t = useT();
  return <Badge tone={RFI_PRIORITY_TONE[priority]}>{t(RFI_PRIORITY_LABEL[priority])}</Badge>;
}

export function ReportStatusBadge({ status }: { status: CaReportStatus }) {
  const t = useT();
  return <Badge tone={CA_REPORT_STATUS_TONE[status]}>{t(CA_REPORT_STATUS_LABEL[status])}</Badge>;
}

export function CertStatusBadge({ status }: { status: CertificationStatus }) {
  const t = useT();
  return <Badge tone={CERT_STATUS_TONE[status]}>{t(CERT_STATUS_LABEL[status])}</Badge>;
}

export function PunchStatusBadge({ status }: { status: PunchStatus }) {
  const t = useT();
  return <Badge tone={PUNCH_STATUS_TONE[status]}>{tCa(t, PUNCH_STATUS_LABEL[status])}</Badge>;
}

export function SiteInstructionStatusBadge({ status }: { status: SiteInstructionStatus }) {
  const t = useT();
  return <Badge tone={SITE_INSTRUCTION_STATUS_TONE[status]}>{t(SITE_INSTRUCTION_STATUS_LABEL[status])}</Badge>;
}

export function SubmittalStatusBadge({ status }: { status: SubmittalStatus }) {
  const t = useT();
  return <Badge tone={SUBMITTAL_STATUS_TONE[status]}>{t(SUBMITTAL_STATUS_LABEL[status])}</Badge>;
}

export function DelayStatusBadge({ status }: { status: DelayStatus }) {
  const t = useT();
  return <Badge tone={DELAY_STATUS_TONE[status]}>{t(DELAY_STATUS_LABEL[status])}</Badge>;
}

export function ImpactBadge({ level, label }: { level: ImpactLevel; label?: string }) {
  const t = useT();
  return <Badge tone={IMPACT_LEVEL_TONE[level]}>{label ? `${label}: ` : ""}{t(IMPACT_LEVEL_LABEL[level])}</Badge>;
}

export function DisciplineBadge({ discipline }: { discipline: CaDiscipline }) {
  const t = useT();
  return <Badge tone="slate">{t(DISCIPLINE_LABEL[discipline])}</Badge>;
}
