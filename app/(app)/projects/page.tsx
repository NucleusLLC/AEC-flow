import Link from "next/link";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ProjectsView } from "@/components/projects/projects-view";
import { getProjects, summarizeProjects } from "@/lib/data/projects";
import { formatCurrencyCompact } from "@/lib/format";

export const metadata = { title: "Projects · AEC-flow" };

export default async function ProjectsPage() {
  const projects = await getProjects();
  const summary = summarizeProjects(projects);

  const tiles = [
    { label: "Active Projects", value: String(summary.active), hint: `${summary.onHold} on hold` },
    { label: "At Risk", value: String(summary.atRisk), hint: "overdue or critical" },
    { label: "Avg Progress", value: `${summary.avgProgress}%`, hint: "across active projects" },
    {
      label: "Portfolio Value",
      value: formatCurrencyCompact(summary.portfolioValue),
      hint: "active contract value",
    },
  ];

  return (
    <div className="w-full space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-fg">Projects</h2>
          <p className="text-sm text-muted">
            Live delivery across disciplines — phases, progress, and project teams.
          </p>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
        >
          <Plus className="h-4 w-4" />
          New Project
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="p-5">
            <div className="text-sm text-muted">{t.label}</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-fg">{t.value}</div>
            <div className="mt-1 text-xs text-faint">{t.hint}</div>
          </Card>
        ))}
      </div>

      <ProjectsView projects={projects} />
    </div>
  );
}
