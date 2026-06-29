import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Printer, Building2, CalendarClock } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { ChangeOrderStatusBadge } from "@/components/construction-admin/badges";
import { getChangeOrder } from "@/lib/data/ca/change-orders";
import { changeOrderBreakdown } from "@/lib/ca/calc";
import { formatCurrency, formatDate } from "@/lib/format";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const co = await getChangeOrder(id);
  return { title: co ? `${co.changeOrderNumber} · ${co.title} · AEC-flow` : "Change Order · AEC-flow" };
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="shrink-0 text-xs text-muted">{label}</span>
      <span className="text-right text-sm text-fg">{children}</span>
    </div>
  );
}

function MoneyRow({ label, value, currency, strong }: { label: string; value: number; currency: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className={strong ? "font-semibold text-fg" : "text-fg"}>{formatCurrency(value, currency)}</span>
    </div>
  );
}

export default async function ChangeOrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const co = await getChangeOrder(id);
  if (!co) notFound();
  const b = changeOrderBreakdown(co);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link href="/construction-admin/change-orders" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
        <ArrowLeft className="h-4 w-4" />
        Change Orders
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-faint">{co.changeOrderNumber}</span>
            <ChangeOrderStatusBadge status={co.status} />
            {co.version > 1 ? <span className="text-[11px] text-faint">rev {co.version}</span> : null}
          </div>
          <h2 className="mt-1 text-xl font-semibold text-fg">{co.title}</h2>
          <span className="inline-flex items-center gap-1.5 text-sm text-muted">
            <Building2 className="h-3.5 w-3.5" />
            {co.projectName}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={`/print/construction-admin/change-orders/${co.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <Printer className="h-4 w-4" />
            Print / PDF
          </a>
          <Link
            href={`/construction-admin/change-orders/${co.id}/edit`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {co.reason || co.description ? (
            <Card>
              <CardHeader title="Scope &amp; Reason" />
              <CardBody className="space-y-3">
                {co.reason ? (
                  <div>
                    <div className="text-xs text-muted">Reason</div>
                    <p className="mt-0.5 text-sm text-fg">{co.reason}</p>
                  </div>
                ) : null}
                {co.description ? (
                  <div>
                    <div className="text-xs text-muted">Description</div>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-fg">{co.description}</p>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Cost Breakdown" subtitle="Markups compounded per the module formula" />
            <CardBody>
              <div className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
                <MoneyRow label="Labor" value={co.costLabor} currency={co.currency} />
                <MoneyRow label="Material" value={co.costMaterial} currency={co.currency} />
                <MoneyRow label="Equipment" value={co.costEquipment} currency={co.currency} />
                <MoneyRow label="Subcontractor" value={co.costSubcontractor} currency={co.currency} />
              </div>
              <div className="mt-3 space-y-2 border-t border-border pt-3">
                <MoneyRow label="Subtotal" value={b.subtotal} currency={co.currency} />
                <MoneyRow label={`Overhead (${co.overheadPercentage}%)`} value={b.overhead} currency={co.currency} />
                <MoneyRow label={`Profit (${co.profitPercentage}%)`} value={b.profit} currency={co.currency} />
                <MoneyRow label={`Contingency (${co.contingencyPercentage}%)`} value={b.contingency} currency={co.currency} />
                <MoneyRow label={`VAT (${co.vatPercentage}%)`} value={b.vat} currency={co.currency} />
                <div className="border-t border-border pt-2">
                  <MoneyRow label="Total cost" value={b.total} currency={co.currency} strong />
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Contract Impact" />
            <CardBody className="space-y-2">
              <MoneyRow label="Original contract" value={co.originalContractValue} currency={co.currency} />
              <MoneyRow label="Approved COs to date" value={co.approvedChangeOrdersToDate} currency={co.currency} />
              <div className="border-t border-border pt-2">
                <MoneyRow label="Revised contract" value={co.revisedContractValue} currency={co.currency} strong />
              </div>
              <div className="pt-1">
                <Row label="Schedule impact">{co.scheduleImpactDays === 0 ? "None" : `${co.scheduleImpactDays > 0 ? "+" : ""}${co.scheduleImpactDays} days`}</Row>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Details" />
            <CardBody className="divide-y divide-border py-0">
              <Row label="Requested by">{co.requestedBy ?? "—"}</Row>
              <Row label="Contractor">{co.contractor ?? "—"}</Row>
              <Row label="Architect">{co.architect ?? "—"}</Row>
              <Row label="Engineer">{co.engineer ?? "—"}</Row>
              <Row label="Owner">{co.owner ?? "—"}</Row>
              <Row label="Requested">{formatDate(co.dateRequested)}</Row>
              <Row label="Submitted">{formatDate(co.dateSubmitted)}</Row>
              <Row label="Approved">{formatDate(co.dateApproved)}</Row>
              <Row label="Updated">
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="h-3.5 w-3.5 text-faint" />
                  {formatDate(co.updatedAt)}
                </span>
              </Row>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
