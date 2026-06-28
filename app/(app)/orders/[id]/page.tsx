import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, FileText, FolderKanban, Pencil, Printer } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/orders/badges";
import { getOrder } from "@/lib/data/orders";
import { formatCurrency, formatDate } from "@/lib/format";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const order = await getOrder(id);
  return { title: order ? `${order.orderNumber} · ZenArch` : "Order · ZenArch" };
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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/orders"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        Orders
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
            Print / PDF
          </Link>
          <Link
            href={`/orders/${order.id}/edit`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
          <div className="text-right">
            <div className="text-xs text-muted">Order fee</div>
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
              <CardHeader title="Scope of Services" />
              <CardBody>
                <p className="text-sm leading-relaxed text-muted">{order.scopeSummary}</p>
              </CardBody>
            </Card>
          ) : null}

          {order.notes ? (
            <Card>
              <CardHeader title="Notes" />
              <CardBody>
                <p className="text-sm leading-relaxed text-muted">{order.notes}</p>
              </CardBody>
            </Card>
          ) : null}

          {/* Linked records */}
          <Card>
            <CardHeader title="Linked Records" />
            <CardBody className="space-y-2">
              {order.proposalRef ? (
                <Link
                  href="/proposals"
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-fg transition-colors hover:bg-surface-2"
                >
                  <FileText className="h-4 w-4 text-faint" />
                  Source proposal
                  <span className="ml-auto font-mono text-xs text-muted">{order.proposalRef}</span>
                </Link>
              ) : null}
              {order.projectId ? (
                <Link
                  href={`/projects/${order.projectId}`}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-fg transition-colors hover:bg-surface-2"
                >
                  <FolderKanban className="h-4 w-4 text-faint" />
                  Delivery project
                  <span className="ml-auto font-mono text-xs text-muted">{order.projectId}</span>
                </Link>
              ) : (
                <p className="text-sm text-muted">No project created yet.</p>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Right: details */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <CardBody className="divide-y divide-border py-0">
              <DetailRow label="Client">{order.clientName}</DetailRow>
              <DetailRow label="Service">{order.serviceType}</DetailRow>
              <DetailRow label="Fee">{formatCurrency(order.fee, order.currency)}</DetailRow>
              <DetailRow label="Start">{formatDate(order.expectedStartDate)}</DetailRow>
              <DetailRow label="End">{formatDate(order.expectedEndDate)}</DetailRow>
              <DetailRow label="Created">{formatDate(order.createdAt)}</DetailRow>
              {order.siteAddress ? (
                <DetailRow label="Site">
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
