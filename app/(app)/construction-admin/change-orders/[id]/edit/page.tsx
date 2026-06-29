import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ChangeOrderForm } from "@/components/construction-admin/change-order-form";
import { getChangeOrder } from "@/lib/data/ca/change-orders";
import { getProjects } from "@/lib/data/projects";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const co = await getChangeOrder(id);
  return { title: co ? `Edit ${co.changeOrderNumber} · AEC-flow` : "Edit Change Order · AEC-flow" };
}

export default async function EditChangeOrderPage({ params }: PageProps) {
  const { id } = await params;
  const [co, projects] = await Promise.all([getChangeOrder(id), getProjects()]);
  if (!co) notFound();
  const options = projects.map((p) => ({ id: p.id, name: p.name, value: p.value }));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link href={`/construction-admin/change-orders/${co.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
        <ArrowLeft className="h-4 w-4" />
        Back to change order
      </Link>
      <div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-faint">{co.changeOrderNumber}</span>
        </div>
        <h2 className="mt-1 text-xl font-semibold text-fg">Edit Change Order</h2>
      </div>
      <ChangeOrderForm
        projects={options}
        mode="edit"
        changeOrderId={co.id}
        initial={{
          projectId: co.projectId,
          title: co.title,
          reason: co.reason ?? "",
          description: co.description ?? "",
          requestedBy: co.requestedBy ?? "",
          contractor: co.contractor ?? "",
          architect: co.architect ?? "",
          engineer: co.engineer ?? "",
          owner: co.owner ?? "",
          status: co.status,
          currency: co.currency,
          costLabor: co.costLabor,
          costMaterial: co.costMaterial,
          costEquipment: co.costEquipment,
          costSubcontractor: co.costSubcontractor,
          overheadPercentage: co.overheadPercentage,
          profitPercentage: co.profitPercentage,
          contingencyPercentage: co.contingencyPercentage,
          vatPercentage: co.vatPercentage,
          scheduleImpactDays: co.scheduleImpactDays,
          originalContractValue: co.originalContractValue,
          approvedChangeOrdersToDate: co.approvedChangeOrdersToDate,
          notes: co.notes ?? "",
        }}
      />
    </div>
  );
}
