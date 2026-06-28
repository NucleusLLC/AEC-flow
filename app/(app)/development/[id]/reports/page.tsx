import { notFound } from "next/navigation";
import { ReportsView } from "@/components/development/reports-view";
import { getDevelopmentProject } from "@/lib/data/development";
import { deriveProjectMetrics } from "@/lib/development/metrics";

type Props = { params: Promise<{ id: string }> };

export default async function DevelopmentReportsPage({ params }: Props) {
  const { id } = await params;
  const project = await getDevelopmentProject(id);
  if (!project) notFound();
  const metrics = deriveProjectMetrics(project);
  return <ReportsView project={project} metrics={metrics} />;
}
