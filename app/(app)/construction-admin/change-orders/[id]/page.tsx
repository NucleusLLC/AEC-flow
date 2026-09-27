import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Printer, Building2, CalendarClock } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { ChangeOrderStatusBadge } from "@/components/construction-admin/badges";
import { getChangeOrder } from "@/lib/data/ca/change-orders";
import { changeOrderBreakdown } from "@/lib/ca/calc";
import { formatCurrency, formatDate } from "@/lib/format";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";

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
  const t = await getServerT();
  const { id } = await params;
  const co = await getChangeOrder(id);
  if (!co) notFound();
  const b = changeOrderBreakdown(co);

  return (
    <div className="w-full space-y-6">
      <Link href="/construction-admin/change-orders" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
        <ArrowLeft className="h-4 w-4" />
        {t("Change Orders")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-faint">{co.changeOrderNumber}</span>
            <ChangeOrderStatusBadge status={co.status} />
            {co.version > 1 ? <span className="text-[11px] text-faint">{fmt(t("rev {version}"), { version: co.version })}</span> : null}
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
            {t("Print / PDF")}
          </a>
          <Link
            href={`/construction-admin/change-orders/${co.id}/edit`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <Pencil className="h-4 w-4" />
            {t("Edit")}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {co.reason || co.description ? (
            <Card>
              <CardHeader title={t("Scope & Reason")} />
              <CardBody className="space-y-3">
                {co.reason ? (
                  <div>
                    <div className="text-xs text-muted">{t("Reason")}</div>
                    <p className="mt-0.5 text-sm text-fg">{co.reason}</p>
                  </div>
                ) : null}
                {co.description ? (
                  <div>
                    <div className="text-xs text-muted">{t("Description")}</div>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-fg">{co.description}</p>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title={t("Cost Breakdown")} subtitle={t("Markups compounded per the module formula")} />
            <CardBody>
              <div className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
                <MoneyRow label={t("Labor")} value={co.costLabor} currency={co.currency} />
                <MoneyRow label={t("Material")} value={co.costMaterial} currency={co.currency} />
                <MoneyRow label={t("Equipment")} value={co.costEquipment} currency={co.currency} />
                <MoneyRow label={t("Subcontractor")} value={co.costSubcontractor} currency={co.currency} />
              </div>
              <div className="mt-3 space-y-2 border-t border-border pt-3">
                <MoneyRow label={t("Subtotal")} value={b.subtotal} currency={co.currency} />
                <MoneyRow label={fmt(t("Overhead ({pct}%)"), { pct: co.overheadPercentage })} value={b.overhead} currency={co.currency} />
                <MoneyRow label={fmt(t("Profit ({pct}%)"), { pct: co.profitPercentage })} value={b.profit} currency={co.currency} />
                <MoneyRow label={fmt(t("Contingency ({pct}%)"), { pct: co.contingencyPercentage })} value={b.contingency} currency={co.currency} />
                <MoneyRow label={fmt(t("VAT ({pct}%)"), { pct: co.vatPercentage })} value={b.vat} currency={co.currency} />
                <div className="border-t border-border pt-2">
                  <MoneyRow label={t("Total cost")} value={b.total} currency={co.currency} strong />
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={t("Contract Impact")} />
            <CardBody className="space-y-2">
              <MoneyRow label={t("Original contract")} value={co.originalContractValue} currency={co.currency} />
              <MoneyRow label={t("Approved COs to date")} value={co.approvedChangeOrdersToDate} currency={co.currency} />
              <div className="border-t border-border pt-2">
                <MoneyRow label={t("Revised contract")} value={co.revisedContractValue} currency={co.currency} strong />
              </div>
              <div className="pt-1">
                <Row label={t("Schedule impact")}>{co.scheduleImpactDays === 0 ? t("None") : fmt(t("{days} days"), { days: `${co.scheduleImpactDays > 0 ? "+" : ""}${co.scheduleImpactDays}` })}</Row>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("Details")} />
            <CardBody className="divide-y divide-border py-0">
              <Row label={t("Requested by")}>{co.requestedBy ?? "—"}</Row>
              <Row label={t("Contractor")}>{co.contractor ?? "—"}</Row>
              <Row label={t("Architect")}>{co.architect ?? "—"}</Row>
              <Row label={t("Engineer")}>{co.engineer ?? "—"}</Row>
              <Row label={t("Owner")}>{co.owner ?? "—"}</Row>
              <Row label={t("Requested")}>{formatDate(co.dateRequested)}</Row>
              <Row label={t("Submitted")}>{formatDate(co.dateSubmitted)}</Row>
              <Row label={t("Approved")}>{formatDate(co.dateApproved)}</Row>
              <Row label={t("Updated")}>
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
