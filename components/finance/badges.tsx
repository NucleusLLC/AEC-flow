import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n/language-provider";
import { fmt } from "@/lib/i18n/format";
import {
  FINANCE_APPROVAL_LABEL,
  FINANCE_APPROVAL_TONE,
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_TONE,
  type FinanceApprovalStatus,
  type InvoiceStatus,
} from "@/lib/finance/types";

/** Wraps the app's existing <Badge>; finance gets no colour system of its own. */
export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const t = useT();
  return <Badge tone={INVOICE_STATUS_TONE[status]}>{t(INVOICE_STATUS_LABEL[status])}</Badge>;
}

/** Only shown when money is late — a badge on every row teaches people to ignore badges. */
export function OverdueBadge({ days }: { days: number | null }) {
  const t = useT();
  if (days === null || days <= 0) return null;
  return (
    <Badge tone="red">
      {days === 1 ? t("1 day overdue") : fmt(t("{count} days overdue"), { count: days })}
    </Badge>
  );
}

/** Where a timesheet row or an expense stands with its approver. */
export function ApprovalBadge({ status }: { status: FinanceApprovalStatus }) {
  const t = useT();
  return <Badge tone={FINANCE_APPROVAL_TONE[status]}>{t(FINANCE_APPROVAL_LABEL[status])}</Badge>;
}

/**
 * Shown only once the row is actually on an invoice. That fact is not a status
 * — it is what stops the hours being billed a second time — so it gets its own
 * badge rather than a sixth value in the approval vocabulary.
 */
export function BilledBadge({ invoiceNumber }: { invoiceNumber: string | null }) {
  const t = useT();
  if (!invoiceNumber) return null;
  return <Badge tone="violet">{fmt(t("Billed on {number}"), { number: invoiceNumber })}</Badge>;
}
