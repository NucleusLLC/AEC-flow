import { Badge } from "@/components/ui/badge";
import {
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_TONE,
  type InvoiceStatus,
} from "@/lib/finance/types";

/** Wraps the app's existing <Badge>; finance gets no colour system of its own. */
export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge tone={INVOICE_STATUS_TONE[status]}>{INVOICE_STATUS_LABEL[status]}</Badge>;
}

/** Only shown when money is late — a badge on every row teaches people to ignore badges. */
export function OverdueBadge({ days }: { days: number | null }) {
  if (days === null || days <= 0) return null;
  return <Badge tone="red">{days} {days === 1 ? "day" : "days"} overdue</Badge>;
}
