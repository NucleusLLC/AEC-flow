import { notFound } from "next/navigation";
import { FolderOpen } from "lucide-react";
import { getProject } from "@/lib/data/projects";
import { ProjectSectionPanel } from "@/components/projects/section-panel";

export default async function ProjectDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getProject(id))) notFound();
  return (
    <ProjectSectionPanel
      icon={<FolderOpen className="h-6 w-6" />}
      title="Documents"
      description="Contracts, correspondence, permits and project records. Manage and download the project's document set."
      moduleLabel="Documents"
      href="/documents"
    />
  );
}
