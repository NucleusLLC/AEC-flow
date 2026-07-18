import { Badge } from "@/components/ui/badge";
import { DELIVERABLE_STATUS_LABEL, type DeliverableStatus } from "@/lib/design/types";

const TONE: Record<DeliverableStatus, "neutral" | "blue" | "green" | "amber" | "red" | "slate"> = {
  DRAFT: "slate",
  IN_REVIEW: "amber",
  ISSUED: "blue",
  SUPERSEDED: "red",
  APPROVED: "green",
};

export function DeliverableStatusBadge({ status }: { status: DeliverableStatus }) {
  return <Badge tone={TONE[status]}>{DELIVERABLE_STATUS_LABEL[status]}</Badge>;
}
