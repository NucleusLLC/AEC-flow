"use client";

import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n/language-provider";
import { PO_STATUS_LABEL, type PurchaseOrderStatus } from "@/lib/procurement/types";

const TONE: Record<PurchaseOrderStatus, "neutral" | "blue" | "green" | "amber" | "red" | "slate"> = {
  DRAFT: "slate",
  ISSUED: "blue",
  PARTIAL: "amber",
  RECEIVED: "green",
  CLOSED: "neutral",
  CANCELLED: "red",
};

export function PoStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  const t = useT();
  return <Badge tone={TONE[status]}>{t(PO_STATUS_LABEL[status])}</Badge>;
}
