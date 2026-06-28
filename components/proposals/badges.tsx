import { Badge } from "@/components/ui/badge";
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
  return <Badge tone={statusTone[status]}>{PROPOSAL_STATUS_LABEL[status]}</Badge>;
}
