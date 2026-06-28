import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { getProject } from "@/lib/data/projects";
import { ProjectSectionPanel } from "@/components/projects/section-panel";

export default async function ProjectProposalsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getProject(id))) notFound();
  return (
    <ProjectSectionPanel
      icon={<FileText className="h-6 w-6" />}
      title="Proposals"
      description="Fee proposals and revisions associated with this project and client."
      moduleLabel="Proposals"
      href="/proposals"
    />
  );
}
