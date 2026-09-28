"use client";

import { useT } from "@/components/i18n/language-provider";
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
  const t = useT();
  return <Badge tone={TONE[status]}>{t(DELIVERABLE_STATUS_LABEL[status])}</Badge>;
}
