import Link from "next/link";
import { Plus, NotebookPen, CalendarRange, ListChecks } from "lucide-react";
import { Card } from "@/components/ui/card";
import { MeetingsView } from "@/components/meetings/meetings-view";
import { getMeetings, summarizeMeetings } from "@/lib/data/meetings";

export const metadata = { title: "Meeting Minutes · ZenArch" };

export default async function MeetingsPage() {
  const meetings = await getMeetings();
  const summary = summarizeMeetings(meetings);

  const tiles = [
    {
      label: "Total Minutes",
      value: String(summary.total),
      hint: "recorded meetings",
      icon: NotebookPen,
      accent: "text-brand",
    },
    {
      label: "This Month",
      value: String(summary.thisMonth),
      hint: "meetings logged",
      icon: CalendarRange,
      accent: "text-blue-600",
    },
    {
      label: "Open Actions",
      value: String(summary.openActions),
      hint: "across all minutes",
      icon: ListChecks,
      accent: "text-amber-600",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-fg">Meeting Minutes</h2>
          <p className="mt-1 text-sm text-muted">
            Record meetings, decisions, and follow-up actions across every project.
          </p>
        </div>
        <Link
          href="/meetings/new"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
        >
          <Plus className="h-4 w-4" />
          New minutes
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

      <MeetingsView meetings={meetings} />
    </div>
  );
}
