import Link from "next/link";
import { FileJson } from "lucide-react";
import { EstimatesApp } from "@/components/estimates/estimates-app";
import { getEstimate, getEstimateProjects } from "@/lib/data/estimates";
import type { EstimateProject } from "@/lib/data/estimates";
import { getProjects } from "@/lib/data/projects";
import { getClients } from "@/lib/data/clients";
import { getPriceBook } from "@/lib/data/price-lists";
import { getNormSet } from "@/lib/data/norm-set";
import { getGeneralConditions } from "@/lib/data/general-conditions-db";
import { getTemplates } from "@/lib/data/estimate-templates";
import { getWikiArticles } from "@/lib/data/estimating-wiki-db";
import { getPracticeSettings } from "@/lib/server/practice-config";
import { getServerT } from "@/lib/i18n/server";

export const metadata = { title: "Cost Estimation · AEC-flow" };

export default async function EstimatesPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project: initialProjectId } = await searchParams;
  // `clients` is loaded so the picker can create a missing project inline —
  // a project must belong to a client.
  const [projects, allProjects, clients, baseEstimate, priceBook, normSet, generalConditions, templates, wiki, practice] = await Promise.all([
    getEstimateProjects(),
    getProjects(),
    getClients(),
    getEstimate(),
    getPriceBook(),
    getNormSet(),
    getGeneralConditions(),
    getTemplates(),
    getWikiArticles(),
    getPracticeSettings(),
  ]);
  const tr = await getServerT();

  // "New estimate" picker lists real projects that don't have an estimate yet
  // (existing estimates already show in the table). A project's estimate is
  // keyed by its own id, so a fresh project (e.g. no estimate yet) can be started.
  const estimatedNumbers = new Set(projects.map((e) => e.projectNumber));
  const startProjects: EstimateProject[] = allProjects
    .filter((p) => !estimatedNumbers.has(p.projectNumber))
    .map((p) => ({
      id: p.id,
      projectNumber: p.projectNumber,
      projectName: p.name,
      address: "",
      client: p.clientName,
      version: "V1.0",
      date: "",
      currency: "",
      status: "draft",
      amount: 0,
    }));

  return (
    <div className="w-full space-y-6">
      <div className="no-print flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
        <h2 className="text-xl font-semibold text-fg">{tr("Cost Estimation")}</h2>
        <p className="text-sm text-muted">
          {tr(
            "Select a project to open its bill-of-quantities estimate — labor norms, materials, equipment and subcontractor costs roll up by section, with profit and overhead applied to the total.",
          )}
        </p>
        </div>
        <Link
          href="/estimates/import"
          data-testid="import-from-mepflow"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
        >
          <FileJson className="h-4 w-4" aria-hidden="true" />
          {tr("Import from MEPflow")}
        </Link>
      </div>

      <EstimatesApp
        projects={projects}
        startProjects={startProjects}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        initialProjectId={initialProjectId}
        baseEstimate={baseEstimate}
        priceBook={priceBook}
        normSet={normSet}
        generalConditions={generalConditions}
        templates={templates}
        wiki={wiki}
        logoDataUrl={practice.logoDataUrl}
        footer={practice.footer}
      />
    </div>
  );
}
