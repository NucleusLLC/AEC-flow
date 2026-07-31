import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { getProject, DISCIPLINE_LABEL, type PhaseStatus } from "@/lib/data/projects";
import { getProjectModulesRollup } from "@/lib/data/project-rollup";
import { ProjectModulesRollupCard } from "@/components/projects/project-modules-rollup";
import { getProjectScheduleSummary } from "@/lib/integrations/schedule/adapter";
import { ProjectProgrammeStatusCard } from "@/components/projects/project-programme-status";
import { formatCurrency, formatDate } from "@/lib/format";
import { initials } from "@/lib/utils";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const project = await getProject(id);
  return { title: project ? `${project.name} · Overview · AEC-flow` : "Project · AEC-flow" };
}

const phaseTone: Record<PhaseStatus, "neutral" | "blue" | "green" | "amber" | "slate"> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "blue",
  ON_HOLD: "amber",
  COMPLETED: "green",
  CANCELLED: "slate",
};

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="shrink-0 text-xs text-muted">{label}</span>
      <span className="text-right text-sm text-fg">{children}</span>
    </div>
  );
}

export default async function ProjectOverviewPage({ params }: PageProps) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  const rollup = await getProjectModulesRollup(id);
  // `ProjectSchedule.projectId` holds the project ROW ID for everything the app
  // saves, but the in-code demo seeds are keyed by project NUMBER — so try the
  // id, then fall back. Read-only: lib/integrations/schedule/adapter.ts.
  const byId = await getProjectScheduleSummary(id);
  const programme = byId.found ? byId : await getProjectScheduleSummary(project.projectNumber);
  const scheduleKey = byId.found ? id : project.projectNumber;

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-fg">Overall progress</span>
          <span className="text-sm font-semibold text-fg">{project.progressPct}%</span>
        </div>
        <ProgressBar value={project.progressPct} className="mt-3" />

        {project.phases.length > 0 ? (
          <div className="mt-5 border-t border-border pt-4">
            <p className="mb-3 text-xs text-muted">
              This number rolls up the {project.phases.length} project phase
              {project.phases.length === 1 ? "" : "s"} below:
            </p>
            <ul className="space-y-2.5">
              {project.phases.map((ph) => (
                <li key={ph.id} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-sm text-fg">{ph.name}</span>
                  <span className="hidden w-32 sm:block">
                    <ProgressBar value={ph.progressPct} />
                  </span>
                  <span className="w-9 shrink-0 text-right text-xs font-medium tabular-nums text-muted">
                    {ph.progressPct}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Phases" subtitle={`${project.phases.length} phases`} />
            <div className="divide-y divide-border">
              {project.phases.map((ph) => (
                <div key={ph.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-fg">{ph.name}</span>
                      {ph.discipline ? <Badge tone="slate">{DISCIPLINE_LABEL[ph.discipline]}</Badge> : null}
                    </div>
                  </div>
                  <Badge tone={phaseTone[ph.status]}>{ph.status.replace(/_/g, " ").toLowerCase()}</Badge>
                  <div className="hidden w-32 sm:block">
                    <ProgressBar value={ph.progressPct} />
                  </div>
                  <span className="w-9 text-right text-xs text-muted">{ph.progressPct}%</span>
                </div>
              ))}
            </div>
          </Card>

          {project.description ? (
            <Card>
              <CardHeader title="Description" />
              <CardBody>
                <p className="text-sm leading-relaxed text-muted">{project.description}</p>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Recent Activity" />
            <CardBody>
              <ol className="space-y-4">
                {project.activity.map((entry) => (
                  <li key={entry.id} className="flex gap-3">
                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand/70" />
                    <div className="min-w-0">
                      <p className="text-sm text-fg">
                        <span className="text-muted">{entry.action}</span> <span className="font-medium">{entry.target}</span>
                      </p>
                      <p className="text-xs text-faint">{entry.at}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <CardBody className="divide-y divide-border py-0">
              <DetailRow label="Manager">{project.manager}</DetailRow>
              <DetailRow label="Start date">{formatDate(project.startDate)}</DetailRow>
              <DetailRow label="Target end">{formatDate(project.targetEndDate)}</DetailRow>
              {project.completedAt ? <DetailRow label="Completed">{formatDate(project.completedAt)}</DetailRow> : null}
              <DetailRow label="Contract value">{formatCurrency(project.value, project.currency)}</DetailRow>
              <DetailRow label="Disciplines">
                <span className="flex flex-wrap justify-end gap-1">
                  {project.disciplines.map((d) => (
                    <Badge key={d} tone="slate">{DISCIPLINE_LABEL[d]}</Badge>
                  ))}
                </span>
              </DetailRow>
              {project.siteAddress ? (
                <DetailRow label="Site">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-faint" />
                    {project.siteAddress}
                  </span>
                </DetailRow>
              ) : null}
            </CardBody>
          </Card>

          <ProjectProgrammeStatusCard summary={programme} scheduleKey={scheduleKey} />

          <ProjectModulesRollupCard rollup={rollup} projectId={id} />

          <Card>
            <CardHeader title="Project Team" subtitle={`${project.team.length} members`} />
            <div className="divide-y divide-border">
              {project.team.map((m) => (
                <div key={m.name} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
                    {initials(m.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-fg">{m.name}</div>
                    <div className="truncate text-xs text-muted">{m.role}</div>
                  </div>
                  {m.discipline ? <Badge tone="slate">{DISCIPLINE_LABEL[m.discipline]}</Badge> : null}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
