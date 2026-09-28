import Link from "next/link";
import { getServerT } from "@/lib/i18n/server";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ProjectsView } from "@/components/projects/projects-view";
import { getProjects, summarizeProjects } from "@/lib/data/projects";
import { formatCurrencyCompact } from "@/lib/format";
import { fmt } from "@/lib/i18n/format";

export async function generateMetadata() {
  const t = await getServerT();
  return { title: `${t("Projects")} · AEC-flow` };
}

export default async function ProjectsPage() {
  const tr = await getServerT();
  const projects = await getProjects();
  const summary = summarizeProjects(projects);

  const tiles = [
    { label: tr("Active Projects"), value: String(summary.active), hint: fmt(tr("{count} on hold"), { count: summary.onHold }) },
    { label: tr("At Risk"), value: String(summary.atRisk), hint: tr("overdue or critical") },
    { label: tr("Avg Progress"), value: `${summary.avgProgress}%`, hint: tr("across active projects") },
    {
      label: tr("Portfolio Value"),
      value: formatCurrencyCompact(summary.portfolioValue),
      hint: tr("active contract value"),
    },
  ];

  return (
    <div className="w-full space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-fg">{tr("Projects")}</h2>
          <p className="text-sm text-muted">
            {tr("Live delivery across disciplines — phases, progress, and project teams.")}
          </p>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
        >
          <Plus className="h-4 w-4" />
          {tr("New Project")}
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
