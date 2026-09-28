"use client";

import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n/language-provider";
import { MATERIAL_STATUS_LABEL, type MaterialSelectionStatus } from "@/lib/materials/types";

const TONE: Record<
  MaterialSelectionStatus,
  "neutral" | "blue" | "green" | "amber" | "red" | "violet" | "slate"
> = {
  PROPOSED: "slate",
  SUBMITTED: "amber",
  APPROVED: "green",
  REJECTED: "red",
  ORDERED: "blue",
  INSTALLED: "violet",
};

export function MaterialStatusBadge({ status }: { status: MaterialSelectionStatus }) {
  const t = useT();
  return <Badge tone={TONE[status]}>{t(MATERIAL_STATUS_LABEL[status])}</Badge>;
}
