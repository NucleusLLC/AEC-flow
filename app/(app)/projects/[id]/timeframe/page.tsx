import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getProject, DISCIPLINE_LABEL, type PhaseStatus } from "@/lib/data/projects";
import { formatDate } from "@/lib/format";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const project = await getProject(id);
  return { title: project ? `${project.name} · Timeframe · ZenArch` : "Project · ZenArch" };
}

const phaseTone: Record<PhaseStatus, "neutral" | "blue" | "green" | "amber" | "slate"> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "blue",
  ON_HOLD: "amber",
  COMPLETED: "green",
  CANCELLED: "slate",
};
const barColor: Record<PhaseStatus, string> = {
  NOT_STARTED: "bg-gray-300",
  IN_PROGRESS: "bg-brand",
  ON_HOLD: "bg-amber-400",
  COMPLETED: "bg-emerald-500",
  CANCELLED: "bg-slate-300",
};

export default async function ProjectTimeframePage({ params }: PageProps) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  // Timeline bounds across all dated phases (+ project start / target end).
  const stamps: number[] = [];
  for (const ph of project.phases) {
    if (ph.startDate) stamps.push(new Date(ph.startDate).getTime());
    if (ph.endDate) stamps.push(new Date(ph.endDate).getTime());
  }
  if (project.startDate) stamps.push(new Date(project.startDate).getTime());
  if (project.targetEndDate) stamps.push(new Date(project.targetEndDate).getTime());
  const min = stamps.length ? Math.min(...stamps) : 0;
  const max = stamps.length ? Math.max(...stamps) : 0;
  const span = max - min || 1;

  const bar = (start: string | null, end: string | null) => {
    if (!start || !end) return null;
    const s = ((new Date(start).getTime() - min) / span) * 100;
    const w = Math.max(2, ((new Date(end).getTime() - new Date(start).getTime()) / span) * 100);
    return { left: `${s}%`, width: `${w}%` };
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Project Timeframe"
          subtitle={
            project.startDate
              ? `${formatDate(project.startDate)} → ${formatDate(project.targetEndDate)}`
              : "Phase schedule"
          }
          action={<CalendarClock className="h-4 w-4 text-faint" />}
        />
        <div className="space-y-3 px-5 py-4">
          {project.phases.map((ph) => {
            const pos = bar(ph.startDate, ph.endDate);
            return (
              <div key={ph.id} className="grid grid-cols-12 items-center gap-3">
                <div className="col-span-4 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-fg">{ph.name}</span>
                    {ph.discipline ? <Badge tone="slate">{DISCIPLINE_LABEL[ph.discipline]}</Badge> : null}
                  </div>
                  <div className="mt-0.5 text-[11px] text-faint">
                    {ph.startDate ? `${formatDate(ph.startDate)} – ${formatDate(ph.endDate)}` : "Dates TBC"}
                  </div>
                </div>
                <div className="col-span-6">
                  <div className="relative h-6 rounded bg-surface-2">
                    {pos ? (
                      <div
                        className={`absolute top-0 flex h-6 items-center rounded ${barColor[ph.status]} px-2`}
                        style={pos}
                      >
                        <span className="truncate text-[10px] font-medium text-white">{ph.progressPct}%</span>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="col-span-2 text-right">
                  <Badge tone={phaseTone[ph.status]}>{ph.status.replace(/_/g, " ").toLowerCase()}</Badge>
                </div>
              </div>
            );
          })}
          {project.phases.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No phases defined for this project yet.</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
