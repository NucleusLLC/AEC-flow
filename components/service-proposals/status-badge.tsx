import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, type ServiceProposalStatus } from "@/lib/proposals/engine/status";

const TONE: Record<ServiceProposalStatus, "neutral" | "blue" | "green" | "amber" | "red" | "slate"> = {
  DRAFT: "slate",
  INTERNAL_REVIEW: "amber",
  APPROVED_FOR_ISSUE: "blue",
  SENT: "blue",
  UNDER_CLIENT_REVIEW: "amber",
  REVISION_REQUESTED: "amber",
  REVISED: "blue",
  ACCEPTED: "green",
  PARTIALLY_ACCEPTED: "green",
  REJECTED: "red",
  EXPIRED: "neutral",
  WITHDRAWN: "neutral",
  SUPERSEDED: "neutral",
  CONVERTED: "green",
};

export function ServiceProposalStatusBadge({ status }: { status: ServiceProposalStatus }) {
  return <Badge tone={TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}
