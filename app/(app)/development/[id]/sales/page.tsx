import { notFound } from "next/navigation";
import { SalesCrm } from "@/components/development/sales-crm";
import { getDevelopmentProject } from "@/lib/data/development";

type Props = { params: Promise<{ id: string }> };

export default async function DevelopmentSalesPage({ params }: Props) {
  const { id } = await params;
  const project = await getDevelopmentProject(id);
  if (!project) notFound();
  return <SalesCrm projectId={project.id} leads={project.leads} lots={project.lots} reservations={project.reservations} salesContracts={project.salesContracts} currency={project.currency} />;
}
