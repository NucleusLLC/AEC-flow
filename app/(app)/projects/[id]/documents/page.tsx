import { notFound } from "next/navigation";
import { FolderOpen } from "lucide-react";
import { getProject } from "@/lib/data/projects";
import { ProjectSectionPanel } from "@/components/projects/section-panel";
import { getServerT } from "@/lib/i18n/server";

export default async function ProjectDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getProject(id))) notFound();
  const t = await getServerT();
  return (
    <ProjectSectionPanel
      icon={<FolderOpen className="h-6 w-6" />}
      title={t("Documents")}
      description={t("Contracts, correspondence, permits and project records. Manage and download the project's document set.")}
      moduleLabel={t("Documents")}
      href="/documents"
    />
  );
}
