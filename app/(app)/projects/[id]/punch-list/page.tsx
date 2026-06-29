import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProject } from "@/lib/data/projects";
import { PunchBoard } from "@/components/projects/punch-board";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const project = await getProject(id);
  return { title: project ? `${project.name} · Punch List · AEC-flow` : "Project · AEC-flow" };
}

export default async function ProjectPunchListPage({ params }: PageProps) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-fg">Punch List · Opleverpunten</h3>
        <p className="text-xs text-muted">Track snags and defects to verified close-out.</p>
      </div>
      <PunchBoard projectId={project.id} />
    </div>
  );
}
