import { notFound } from "next/navigation";
import { CashFlowPlanner } from "@/components/development/cash-flow-planner";
import { getDevelopmentProject } from "@/lib/data/development";

type Props = { params: Promise<{ id: string }> };

export default async function DevelopmentCashFlowPage({ params }: Props) {
  const { id } = await params;
  const project = await getDevelopmentProject(id);
  if (!project) notFound();
  return <CashFlowPlanner projectId={project.id} months={project.cashFlow} currency={project.currency} />;
}
