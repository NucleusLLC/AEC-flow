import { notFound } from "next/navigation";
import { PermitTracker } from "@/components/development/permit-tracker";
import { getDevelopmentProject } from "@/lib/data/development";

type Props = { params: Promise<{ id: string }> };

export default async function DevelopmentPermitsPage({ params }: Props) {
  const { id } = await params;
  const project = await getDevelopmentProject(id);
  if (!project) notFound();
  return <PermitTracker projectId={project.id} permits={project.permits} />;
}
