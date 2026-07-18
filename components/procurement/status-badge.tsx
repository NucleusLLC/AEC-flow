import { Badge } from "@/components/ui/badge";
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
  return <Badge tone={TONE[status]}>{PO_STATUS_LABEL[status]}</Badge>;
}
