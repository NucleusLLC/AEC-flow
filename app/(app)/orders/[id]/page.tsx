import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, FileText, FolderKanban, Pencil, Printer } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/orders/badges";
import { getOrder } from "@/lib/data/orders";
import { formatCurrency, formatDate } from "@/lib/format";
import { getServerT } from "@/lib/i18n/server";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const order = await getOrder(id);
  const t = await getServerT();
  return { title: order ? `${order.orderNumber} · AEC-flow` : `${t("Order")} · AEC-flow` };
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="shrink-0 text-xs text-muted">{label}</span>
      <span className="text-right text-sm text-fg">{children}</span>
    </div>
  );
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();
  const t = await getServerT();

  return (
    <div className="w-full space-y-6">
      <Link
        href="/orders"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("Orders")}
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-faint">{order.orderNumber}</span>
            <OrderStatusBadge status={order.status} />
          </div>
          <h2 className="mt-1 text-xl font-semibold text-fg">{order.title}</h2>
          <span className="text-sm text-muted">
            {order.clientName} · {order.serviceType}
          </span>
        </div>
        <div className="flex shrink-0 flex-wrap items-start gap-4">
          <Link
            href={`/print/orders/${order.id}`}
            target="_blank"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <Printer className="h-4 w-4" />
            {t("Print / PDF")}
          </Link>
          <Link
            href={`/orders/${order.id}/edit`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <Pencil className="h-4 w-4" />
            {t("Edit")}
          </Link>
          <div className="text-right">
            <div className="text-xs text-muted">{t("Order fee")}</div>
            <div className="text-xl font-semibold text-fg">
              {formatCurrency(order.fee, order.currency)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: scope + notes */}
        <div className="space-y-6 lg:col-span-2">
          {order.scopeSummary ? (
            <Card>
              <CardHeader title={t("Scope of Services")} />
              <CardBody>
                <p className="text-sm leading-relaxed text-muted">{order.scopeSummary}</p>
              </CardBody>
            </Card>
          ) : null}

          {order.notes ? (
            <Card>
              <CardHeader title={t("Notes")} />
              <CardBody>
                <p className="text-sm leading-relaxed text-muted">{order.notes}</p>
              </CardBody>
            </Card>
          ) : null}

          {/* Linked records */}
          <Card>
            <CardHeader title={t("Linked Records")} />
            <CardBody className="space-y-2">
              {order.proposalRef ? (
                <Link
                  href="/proposals"
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-fg transition-colors hover:bg-surface-2"
                >
                  <FileText className="h-4 w-4 text-faint" />
                  {t("Source proposal")}
                  <span className="ml-auto font-mono text-xs text-muted">{order.proposalRef}</span>
                </Link>
              ) : null}
              {order.projectId ? (
                <Link
                  href={`/projects/${order.projectId}`}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-fg transition-colors hover:bg-surface-2"
                >
                  <FolderKanban className="h-4 w-4 text-faint" />
                  {t("Delivery project")}
                  <span className="ml-auto font-mono text-xs text-muted">{order.projectId}</span>
                </Link>
              ) : (
                <p className="text-sm text-muted">{t("No project created yet.")}</p>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Right: details */}
        <div className="space-y-6">
          <Card>
            <CardHeader title={t("Details")} />
            <CardBody className="divide-y divide-border py-0">
              <DetailRow label={t("Client")}>{order.clientName}</DetailRow>
              <DetailRow label={t("Service")}>{order.serviceType}</DetailRow>
              <DetailRow label={t("Fee")}>{formatCurrency(order.fee, order.currency)}</DetailRow>
              <DetailRow label={t("Start")}>{formatDate(order.expectedStartDate)}</DetailRow>
              <DetailRow label={t("End")}>{formatDate(order.expectedEndDate)}</DetailRow>
              <DetailRow label={t("Created")}>{formatDate(order.createdAt)}</DetailRow>
              {order.siteAddress ? (
                <DetailRow label={t("Site")}>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-faint" />
                    {order.siteAddress}
                  </span>
                </DetailRow>
              ) : null}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
