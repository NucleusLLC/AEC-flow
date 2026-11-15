import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { MeetingForm } from "@/components/meetings/meeting-form";
import { getProject } from "@/lib/data/projects";
import { getTeam } from "@/lib/data/team";
import { projectMeetingsHref } from "@/lib/meetings/paths";
import { getServerT } from "@/lib/i18n/server";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return { title: `${t("New minutes")} · AEC-flow` };
}

/** New minutes, filed under this project — the project is fixed, not chosen. */
export default async function NewProjectMeetingPage({ params }: PageProps) {
  const { id } = await params;
  const [project, team] = await Promise.all([getProject(id), getTeam()]);
  if (!project) notFound();
  const t = await getServerT();
  const backHref = projectMeetingsHref(project.id);

  return (
    <div className="space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("Meeting Minutes")}
      </Link>
      <div>
        <h3 className="text-xl font-semibold text-fg">{t("New minutes")}</h3>
        <p className="text-sm text-muted">
          {t("Record a meeting with participants, decisions, and follow-up actions.")}
        </p>
      </div>
      <MeetingForm
        mode="new"
        projects={[{ id: project.id, name: project.name, projectNumber: project.projectNumber }]}
        users={team.map((u) => ({ name: u.name }))}
        fixedProjectId={project.id}
        backHref={backHref}
      />
    </div>
  );
}
