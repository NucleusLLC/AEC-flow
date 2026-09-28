import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { getMaterialSelection } from "@/lib/data/materials";
import { getPurchaseOrder } from "@/lib/data/procurement";
import { formatCurrency } from "@/lib/format";
import { Card, CardBody } from "@/components/ui/card";
import { MaterialStatusBadge } from "@/components/materials/status-badge";
import { MaterialDeleteButton } from "@/components/materials/material-delete-button";
import { getServerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return { title: `${t("Selection")} · AEC-flow` };
}

export default async function MaterialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const m = await getMaterialSelection(id);
  if (!m) notFound();
  const t = await getServerT();
  const po = m.purchaseOrderId ? await getPurchaseOrder(m.purchaseOrderId) : null;

  const money = (n: number) => formatCurrency(n, m.currency, { maximumFractionDigits: 2 });

  return (
    <div className="w-full max-w-4xl space-y-6">
      <Link href="/materials" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
        <ArrowLeft className="h-4 w-4" />
        {t("Material Selection")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-muted">{m.tag}</span>
            <MaterialStatusBadge status={m.status} />
          </div>
          <h2 className="mt-1 text-xl font-semibold text-fg">{m.productName}</h2>
          <p className="text-sm text-muted">
            {t(m.category)}
            {m.manufacturer ? ` · ${m.manufacturer}` : ""}
            {m.projectName ? ` · ${m.projectName}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/materials/${m.id}/edit`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <Pencil className="h-4 w-4" /> {t("Edit")}
          </Link>
          <MaterialDeleteButton id={m.id} tag={m.tag} />
        </div>
      </div>

      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <Field label={t("Category")} value={t(m.category)} />
          <Field label={t("Location / area")} value={m.location ?? "—"} />
          <Field label={t("Manufacturer")} value={m.manufacturer ?? "—"} />
          <Field label={t("Model / SKU")} value={m.modelNumber ?? "—"} />
          <Field label={t("Finish / colour")} value={m.finish ?? "—"} />
          <Field label={t("Specification")} value={m.specification ?? "—"} />
          <Field label={t("Supplier")} value={m.supplier ?? "—"} />
          <Field label={t("Approved by")} value={m.approvedBy ?? "—"} />
          <Field label={t("Selected date")} value={m.selectedDate ?? "—"} />
        </CardBody>
      </Card>

      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-4">
          <Field label={t("Quantity")} value={`${m.quantity}${m.unit ? ` ${m.unit}` : ""}`} />
          <Field label={t("Unit cost")} value={money(m.unitCost)} />
          <Field label={t("Extended cost")} value={money(m.totalCost)} />
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted">{t("Purchase order")}</div>
            <div className="mt-0.5 text-sm">
              {po ? (
                <Link href={`/procurement/${po.id}`} className="font-medium text-brand hover:underline">
                  {po.poNumber}
                </Link>
              ) : (
                <span className="text-fg">—</span>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {m.notes ? (
        <Card>
          <CardBody>
            <div className="text-xs font-medium uppercase tracking-wide text-muted">{t("Notes")}</div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-fg">{m.notes}</p>
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
