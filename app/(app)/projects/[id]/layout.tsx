import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { StatusBadge, PriorityBadge } from "@/components/ui/badge";
import { ProjectTabBar } from "@/components/projects/project-tab-bar";
import { getProject } from "@/lib/data/projects";
import { getServerT } from "@/lib/i18n/server";
import { ProjectLifecycleButtons } from "@/components/projects/project-lifecycle-buttons";
import { requireActor } from "@/lib/server/actor";
import { canManagePasswords } from "@/lib/password-policy";

type LayoutProps = { children: React.ReactNode; params: Promise<{ id: string }> };

export default async function ProjectWorkspaceLayout({ children, params }: LayoutProps) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  const t = await getServerT();
  const actor = await requireActor().catch(() => null);
  const canManage = actor ? canManagePasswords(actor.role, actor.isFounder) : false;

  return (
    <div className="w-full space-y-5">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("Projects")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-faint">{project.projectNumber}</span>
            <StatusBadge status={project.status} />
            <PriorityBadge priority={project.priority} />
          </div>
          <h2 className="mt-1 text-xl font-semibold text-fg">{project.name}</h2>
          <Link href={`/clients/${project.clientId}`} className="text-sm text-muted hover:text-brand hover:underline">
            {project.clientName}
          </Link>
        </div>
        <div className="flex flex-wrap items-start justify-end gap-2">
          <Link
            href={`/projects/${project.id}/overview`}
            className="inline-flex h-9 shrink-0 items-center rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            {t("Project details")}
          </Link>
          <ProjectLifecycleButtons
            projectId={project.id}
            projectNumber={project.projectNumber}
            projectName={project.name}
            archivedAt={project.archivedAt}
            canManage={canManage}
          />
        </div>
      </div>

      <ProjectTabBar projectId={project.id} />

      {children}
    </div>
  );
}
