import { notFound } from "next/navigation";
import { CostBudget } from "@/components/development/cost-budget";
import { getDevelopmentProject } from "@/lib/data/development";

type Props = { params: Promise<{ id: string }> };

export default async function DevelopmentCostsPage({ params }: Props) {
  const { id } = await params;
  const project = await getDevelopmentProject(id);
  if (!project) notFound();
  return <CostBudget projectId={project.id} budget={project.budget} currency={project.currency} />;
}
