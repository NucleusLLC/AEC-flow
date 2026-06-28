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
  return <Badge tone={CHANGE_ORDER_STATUS_TONE[status]}>{CHANGE_ORDER_STATUS_LABEL[status]}</Badge>;
}

export function RfiStatusBadge({ status }: { status: RfiStatus }) {
  return <Badge tone={RFI_STATUS_TONE[status]}>{RFI_STATUS_LABEL[status]}</Badge>;
}

export function RfiPriorityBadge({ priority }: { priority: RfiPriority }) {
  return <Badge tone={RFI_PRIORITY_TONE[priority]}>{RFI_PRIORITY_LABEL[priority]}</Badge>;
}

export function ReportStatusBadge({ status }: { status: CaReportStatus }) {
  return <Badge tone={CA_REPORT_STATUS_TONE[status]}>{CA_REPORT_STATUS_LABEL[status]}</Badge>;
}

export function CertStatusBadge({ status }: { status: CertificationStatus }) {
  return <Badge tone={CERT_STATUS_TONE[status]}>{CERT_STATUS_LABEL[status]}</Badge>;
}

export function PunchStatusBadge({ status }: { status: PunchStatus }) {
  return <Badge tone={PUNCH_STATUS_TONE[status]}>{PUNCH_STATUS_LABEL[status]}</Badge>;
}

export function SiteInstructionStatusBadge({ status }: { status: SiteInstructionStatus }) {
  return <Badge tone={SITE_INSTRUCTION_STATUS_TONE[status]}>{SITE_INSTRUCTION_STATUS_LABEL[status]}</Badge>;
}

export function SubmittalStatusBadge({ status }: { status: SubmittalStatus }) {
  return <Badge tone={SUBMITTAL_STATUS_TONE[status]}>{SUBMITTAL_STATUS_LABEL[status]}</Badge>;
}

export function DelayStatusBadge({ status }: { status: DelayStatus }) {
  return <Badge tone={DELAY_STATUS_TONE[status]}>{DELAY_STATUS_LABEL[status]}</Badge>;
}

export function ImpactBadge({ level, label }: { level: ImpactLevel; label?: string }) {
  return <Badge tone={IMPACT_LEVEL_TONE[level]}>{label ? `${label}: ` : ""}{IMPACT_LEVEL_LABEL[level]}</Badge>;
}

export function DisciplineBadge({ discipline }: { discipline: CaDiscipline }) {
  return <Badge tone="slate">{DISCIPLINE_LABEL[discipline]}</Badge>;
}
