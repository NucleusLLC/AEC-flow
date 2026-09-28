"use client";

import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n/language-provider";
import { PROPOSAL_STATUS_LABEL, type ProposalStatus } from "@/lib/data/proposals.types";

type Tone = "neutral" | "blue" | "green" | "amber" | "red" | "violet" | "slate";

const statusTone: Record<ProposalStatus, Tone> = {
  DRAFT: "neutral",
  SENT: "blue",
  PENDING: "amber",
  APPROVED: "green",
  ON_HOLD: "violet",
  REJECTED: "red",
  VOID: "slate",
};

export function ProposalStatusBadge({ status }: { status: ProposalStatus }) {
  const t = useT();
  return <Badge tone={statusTone[status]}>{t(PROPOSAL_STATUS_LABEL[status])}</Badge>;
}
