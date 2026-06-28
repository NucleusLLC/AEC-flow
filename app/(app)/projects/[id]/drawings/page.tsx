import { notFound } from "next/navigation";
import { FileStack } from "lucide-react";
import { getProject } from "@/lib/data/projects";
import { ProjectSectionPanel } from "@/components/projects/section-panel";

export default async function ProjectDrawingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getProject(id))) notFound();
  return (
    <ProjectSectionPanel
      icon={<FileStack className="h-6 w-6" />}
      title="Drawings"
      description="Architectural, structural and MEP drawing sets with revisions and issue tracking."
      moduleLabel="Drawings"
      href="/drawings"
    />
  );
}
