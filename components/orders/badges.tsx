import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/data/orders.types";

type Tone = "neutral" | "blue" | "green" | "amber" | "red" | "violet" | "slate";

const statusTone: Record<OrderStatus, Tone> = {
  DRAFT: "neutral",
  CONFIRMED: "blue",
  IN_PROGRESS: "amber",
  COMPLETED: "green",
  CANCELLED: "slate",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={statusTone[status]}>{ORDER_STATUS_LABEL[status]}</Badge>;
}
