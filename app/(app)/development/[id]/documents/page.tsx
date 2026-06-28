import { notFound } from "next/navigation";
import { DocumentsView } from "@/components/development/documents-view";
import { getDevelopmentProject } from "@/lib/data/development";

type Props = { params: Promise<{ id: string }> };

export default async function DevelopmentDocumentsPage({ params }: Props) {
  const { id } = await params;
  const project = await getDevelopmentProject(id);
  if (!project) notFound();
  return <DocumentsView projectId={project.id} documents={project.documents} />;
}
