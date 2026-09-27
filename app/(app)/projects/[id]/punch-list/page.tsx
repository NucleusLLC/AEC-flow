import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProject } from "@/lib/data/projects";
import { PunchBoard } from "@/components/projects/punch-board";
import { getServerT } from "@/lib/i18n/server";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const project = await getProject(id);
  const t = await getServerT();
  return { title: project ? `${project.name} · ${t("Punch List")} · AEC-flow` : `${t("Project")} · AEC-flow` };
}

export default async function ProjectPunchListPage({ params }: PageProps) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  const t = await getServerT();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-fg">{t("Punch List")}</h3>
        <p className="text-xs text-muted">{t("Track snags and defects to verified close-out.")}</p>
      </div>
      <PunchBoard projectId={project.id} />
    </div>
  );
}
