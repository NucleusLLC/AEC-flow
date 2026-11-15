import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, NotebookPen, CalendarRange, ListChecks } from "lucide-react";
import { Card } from "@/components/ui/card";
import { MeetingsView } from "@/components/meetings/meetings-view";
import { getMeetingsForProject, summarizeMeetings } from "@/lib/data/meetings";
import { getProject } from "@/lib/data/projects";
import { newMeetingHref } from "@/lib/meetings/paths";
import { getServerT } from "@/lib/i18n/server";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const project = await getProject(id);
  const t = await getServerT();
  return {
    title: project
      ? `${project.name} · ${t("Meeting Minutes")} · AEC-flow`
      : `${t("Meeting Minutes")} · AEC-flow`,
  };
}

/** The project's own Meeting Minutes section: every set of minutes filed under it. */
export default async function ProjectMeetingsPage({ params }: PageProps) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  const tr = await getServerT();
  const meetings = await getMeetingsForProject(project.id);
  const summary = summarizeMeetings(meetings);

  const tiles = [
    {
      label: tr("Total Minutes"),
      value: String(summary.total),
      hint: tr("recorded meetings"),
      icon: NotebookPen,
      accent: "text-brand",
    },
    {
      label: tr("This Month"),
      value: String(summary.thisMonth),
      hint: tr("meetings logged"),
      icon: CalendarRange,
      accent: "text-blue-600",
    },
    {
      label: tr("Open Actions"),
      value: String(summary.openActions),
      hint: tr("on this project"),
      icon: ListChecks,
      accent: "text-amber-600",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-fg">{tr("Meeting Minutes")}</h3>
          <p className="text-xs text-muted">
            {tr("Meetings, decisions and follow-up actions for this project.")}
          </p>
        </div>
        <Link
          href={newMeetingHref(project.id)}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
        >
          <Plus className="h-4 w-4" />
          {tr("New minutes")}
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Card key={t.label} className="p-5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">{t.label}</div>
                <Icon className={`h-4 w-4 ${t.accent}`} />
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-fg">{t.value}</div>
              <div className="mt-1 text-xs text-faint">{t.hint}</div>
            </Card>
          );
        })}
      </div>

      {meetings.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-faint">
            <NotebookPen className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-fg">{tr("No meeting minutes logged for this project yet.")}</p>
          <Link href={newMeetingHref(project.id)} className="text-sm font-medium text-brand hover:underline">
            {tr("New minutes")}
          </Link>
        </Card>
      ) : (
        <MeetingsView meetings={meetings} />
      )}
    </div>
  );
}
