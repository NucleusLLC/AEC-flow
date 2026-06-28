import { notFound } from "next/navigation";
import { DevDashboardView } from "@/components/development/dashboard-view";
import { getDevelopmentProject } from "@/lib/data/development";
import { deriveProjectMetrics } from "@/lib/development/metrics";
import { formatDate } from "@/lib/format";

type Props = { params: Promise<{ id: string }> };

export default async function DevelopmentDashboardPage({ params }: Props) {
  const { id } = await params;
  const project = await getDevelopmentProject(id);
  if (!project) notFound();
  const metrics = deriveProjectMetrics(project);
  return <DevDashboardView metrics={metrics} closeoutDate={formatDate(project.targetCloseoutDate)} />;
}
