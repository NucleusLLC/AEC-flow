import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PurchaseOrderForm } from "@/components/procurement/purchase-order-form";
import { getPurchaseOrder } from "@/lib/data/procurement";
import { getProjects } from "@/lib/data/projects";

export const metadata: Metadata = { title: "Edit Purchase Order · AEC-flow" };

export default async function EditPurchaseOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [po, projects] = await Promise.all([getPurchaseOrder(id), getProjects()]);
  if (!po) notFound();
  const options = projects.map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="w-full max-w-5xl space-y-6">
      <Link
        href={`/procurement/${po.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        {po.poNumber}
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-fg">Edit {po.poNumber}</h2>
        <p className="text-sm text-muted">Totals recalculate on save.</p>
      </div>
      <PurchaseOrderForm projects={options} mode="edit" initial={po} />
    </div>
  );
}
