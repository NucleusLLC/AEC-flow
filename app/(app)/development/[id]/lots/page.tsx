import { notFound } from "next/navigation";
import { LotTable } from "@/components/development/lot-table";
import { getDevelopmentProject, projectCostPerNetM2 } from "@/lib/data/development";

type Props = { params: Promise<{ id: string }> };

export default async function DevelopmentLotsPage({ params }: Props) {
  const { id } = await params;
  const project = await getDevelopmentProject(id);
  if (!project) notFound();
  const costPerNetM2 = projectCostPerNetM2(project);
  return <LotTable projectId={project.id} lots={project.lots} costPerNetM2={costPerNetM2} currency={project.currency} />;
}
