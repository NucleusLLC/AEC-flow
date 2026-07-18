import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Printer } from "lucide-react";
import { getPurchaseOrder } from "@/lib/data/procurement";
import { lineAmount } from "@/lib/procurement/calc";
import { formatCurrency } from "@/lib/format";
import { Card, CardBody } from "@/components/ui/card";
import { PoStatusBadge } from "@/components/procurement/status-badge";
import { PoDeleteButton } from "@/components/procurement/po-delete-button";

export const metadata: Metadata = { title: "Purchase Order · AEC-flow" };

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const po = await getPurchaseOrder(id);
  if (!po) notFound();

  const money = (n: number) => formatCurrency(n, po.currency, { maximumFractionDigits: 2 });

  return (
    <div className="w-full max-w-4xl space-y-6">
      <Link href="/procurement" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
        <ArrowLeft className="h-4 w-4" />
        Procurement
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-mono text-xl font-semibold text-fg">{po.poNumber}</h2>
            <PoStatusBadge status={po.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {po.vendorName}
            {po.projectName ? ` · ${po.projectName}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/print/procurement/${po.id}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <Printer className="h-4 w-4" /> Print
          </Link>
          <Link
            href={`/procurement/${po.id}/edit`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <Pencil className="h-4 w-4" /> Edit
          </Link>
          <PoDeleteButton id={po.id} poNumber={po.poNumber} />
        </div>
      </div>

      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-4">
          <Field label="Supplier" value={po.vendorName} />
          <Field label="Contact" value={po.vendorContact ?? "—"} />
          <Field label="Email" value={po.vendorEmail ?? "—"} />
          <Field label="Currency" value={po.currency} />
          <Field label="Order date" value={po.orderDate ?? "—"} />
          <Field label="Expected" value={po.expectedDate ?? "—"} />
          <Field label="Received" value={po.receivedDate ?? "—"} />
          <Field label="Terms" value={po.terms ?? "—"} />
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5 font-medium">Description</th>
                <th className="px-4 py-2.5 text-right font-medium">Qty</th>
                <th className="px-4 py-2.5 font-medium">Unit</th>
                <th className="px-4 py-2.5 text-right font-medium">Unit price</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {po.lineItems.map((l, i) => (
                <tr key={i} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2.5 text-fg">{l.description || "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted">{l.quantity}</td>
                  <td className="px-4 py-2.5 text-muted">{l.unit || "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted">{money(l.unitPrice)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-fg">{money(lineAmount(l))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end border-t border-border px-4 py-3">
            <dl className="w-56 space-y-1.5 text-sm">
              <Row k="Subtotal" v={money(po.subtotal)} />
              <Row k={`Tax (${po.taxPercentage}%)`} v={money(po.subtotal * (po.taxPercentage / 100))} />
              <Row k="Shipping" v={money(po.shipping)} />
              <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold text-fg">
                <dt>Total</dt>
                <dd className="tabular-nums">{money(po.total)}</dd>
              </div>
            </dl>
          </div>
        </CardBody>
      </Card>

      {po.notes ? (
        <Card>
          <CardBody>
            <div className="text-xs font-medium uppercase tracking-wide text-muted">Notes</div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-fg">{po.notes}</p>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 text-sm text-fg">{value}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-muted">
      <dt>{k}</dt>
      <dd className="tabular-nums text-fg">{v}</dd>
    </div>
  );
}
