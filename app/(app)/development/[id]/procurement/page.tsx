import { notFound } from "next/navigation";
import { ProcurementView } from "@/components/development/procurement-view";
import { getDevelopmentProject } from "@/lib/data/development";

type Props = { params: Promise<{ id: string }> };

export default async function DevelopmentProcurementPage({ params }: Props) {
  const { id } = await params;
  const project = await getDevelopmentProject(id);
  if (!project) notFound();
  return (
    <ProcurementView
      projectId={project.id}
      vendors={project.vendors}
      contracts={project.contracts}
      invoices={project.invoices}
      payments={project.payments}
      currency={project.currency}
    />
  );
}
