import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, NotebookPen, Plus } from "lucide-react";
import { ProjectDashboard } from "@/components/projects/dashboard/project-dashboard";
import { Card } from "@/components/ui/card";
import { MeetingTypeBadge } from "@/components/meetings/badges";
import { getProject } from "@/lib/data/projects";
import { getMeetingsForProject } from "@/lib/data/meetings";
import { getActivityForProject } from "@/lib/data/activity";
import { formatDate } from "@/lib/format";
import type { ProjectSummary } from "@/lib/dashboard";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const project = await getProject(id);
  return { title: project ? `${project.name} · Dashboard · ZenArch` : "Project · ZenArch" };
}

export default async function ProjectDashboardPage({ params }: PageProps) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  const meetings = await getMeetingsForProject(project.id);
  const activity = await getActivityForProject(project.id);

  const summary: ProjectSummary = {
    id: project.id,
    name: project.name,
    projectNumber: project.projectNumber,
    progressPct: project.progressPct,
    value: project.value,
    currency: project.currency,
    startDate: project.startDate,
    targetEndDate: project.targetEndDate,
    siteAddress: project.siteAddress,
    phases: project.phases.map((p) => ({ name: p.name, status: p.status, progressPct: p.progressPct })),
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="font-mono text-xs text-faint">{project.projectNumber}</span>
          <h2 className="truncate text-xl font-semibold text-fg">{project.name}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={`/print/projects/${project.id}`}
            target="_blank"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            Print
          </a>
          <Link
            href={`/projects/${project.id}/edit`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
        </div>
      </div>
      <ProjectDashboard project={summary} />

      {/* Meeting Minutes logged against this project. */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg">
            <NotebookPen className="h-4 w-4 text-brand" /> Meeting Minutes
            <span className="text-xs font-normal text-faint">({meetings.length})</span>
          </h3>
          <Link
            href="/meetings/new"
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <Plus className="h-3.5 w-3.5" /> New minutes
          </Link>
        </div>
        {meetings.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted">
            No meeting minutes logged for this project yet.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {meetings.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/meetings/${m.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
                >
                  <span className="w-24 shrink-0 text-xs tabular-nums text-faint">{formatDate(m.meetingDate)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{m.title}</span>
                  <MeetingTypeBadge type={m.type} />
                  <span className="hidden shrink-0 text-xs text-muted sm:inline">
                    {m.actionItemsCount} action{m.actionItemsCount === 1 ? "" : "s"}
                    {m.openActionsCount > 0 ? ` · ${m.openActionsCount} open` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Recent activity on this project. */}
      {activity.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-fg">Recent Activity</h3>
          </div>
          <ol className="divide-y divide-border">
            {activity.slice(0, 8).map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 px-4 py-2.5">
                <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand/70" />
                <p className="min-w-0 flex-1 text-sm text-fg">
                  <span className="font-medium">{entry.actor}</span>{" "}
                  <span className="text-muted">{entry.action} {entry.entityType}</span>{" "}
                  {entry.href ? (
                    <Link href={entry.href} className="font-medium hover:text-brand hover:underline">{entry.entityLabel}</Link>
                  ) : (
                    <span className="font-medium">{entry.entityLabel}</span>
                  )}
                  <span className="ml-1 text-xs text-faint">· {entry.at}</span>
                </p>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}
    </div>
  );
}
