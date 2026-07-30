"use client";

import { useState, useTransition, useEffect } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { CostEstimate, EstimateProject } from "@/lib/data/estimates";
import type { PriceItem } from "@/lib/data/price-lists.types";
import type { NormSetTask, EstimateTemplate } from "@/lib/data/estimate-presets";
import type { GeneralConditionItem } from "@/lib/data/general-conditions";
import type { WikiArticle } from "@/lib/data/estimating-wiki";
import { getSystemCurrency } from "@/lib/format";
import type { FooterSettings } from "@/lib/server/practice-config";
import { loadEstimateAction } from "@/app/(app)/estimates/actions";
import { ProjectListView } from "./project-list-view";
import { EstimateWorkspace } from "./estimate-workspace";

type PriceBook = { materials: PriceItem[]; equipment: PriceItem[] };

export function EstimatesApp({ projects, startProjects, clients, initialProjectId, baseEstimate, priceBook, normSet, generalConditions, templates, wiki, logoDataUrl, footer }: { projects: EstimateProject[]; startProjects?: EstimateProject[]; /** Clients a project created inline can be filed under. */ clients?: { id: string; name: string }[]; initialProjectId?: string; baseEstimate: CostEstimate; priceBook: PriceBook; normSet: NormSetTask[]; generalConditions: GeneralConditionItem[]; templates: EstimateTemplate[]; wiki: WikiArticle[]; logoDataUrl?: string | null; footer?: FooterSettings }) {
  const [selected, setSelected] = useState<EstimateProject | null>(null);
  // The selected estimate's OWN persisted sheet (loaded by id), not the base seed.
  const [working, setWorking] = useState<CostEstimate | null>(null);
  const [loading, startLoad] = useTransition();

  const openProject = (p: EstimateProject) => {
    setSelected(p);
    setWorking(null);
    startLoad(async () => {
      const est = await loadEstimateAction(p.id);
      // Defensive fallback (id should always resolve): an EMPTY sheet with the
      // project header — never the base estimate's lines, which would corrupt this id.
      setWorking(
        est ?? {
          ...baseEstimate,
          id: p.id,
          projectId: p.projectNumber,
          projectName: p.projectName,
          location: p.address,
          client: p.client,
          version: p.version,
          date: p.date,
          currency: p.currency || getSystemCurrency(),
          // A brand-new estimate starts with one section + one placeholder line
          // so there's something to build on (not a blank sheet).
          categories: [
            {
              id: "sec-1",
              name: "Section 1",
              code: "",
              items: [
                {
                  id: "item-1",
                  task: "Etc.",
                  qty: 0,
                  unit: "",
                  laborNorm: 0,
                  materialUnitCost: 0,
                  equipmentUnitCost: 0,
                  subcontractUnitCost: 0,
                  poc: 0,
                  code: "",
                },
              ],
            },
          ],
        },
      );
    });
  };

  const close = () => {
    setSelected(null);
    setWorking(null);
  };

  // Deep-link from a Project → "Create/Open estimate": auto-open that project's
  // estimate (existing one in the table, or a fresh sheet from startProjects).
  useEffect(() => {
    if (!initialProjectId) return;
    const match = [...(startProjects ?? []), ...projects].find((p) => p.id === initialProjectId);
    if (match) openProject(match);
    // Run once for the incoming project id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProjectId]);

  if (!selected) {
    return <ProjectListView projects={projects} startProjects={startProjects ?? []} clients={clients ?? []} onSelect={openProject} />;
  }

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center gap-2">
        <button type="button" onClick={close} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg">
          <ArrowLeft className="h-4 w-4" /> All estimates
        </button>
        <span className="text-sm text-faint">/</span>
        <span className="font-mono text-xs text-faint">{selected.projectNumber}</span>
        <span className="text-sm font-semibold text-fg">{selected.projectName}</span>
        <span className="text-xs text-muted">· {selected.client}</span>
      </div>
      {working ? (
        <EstimateWorkspace key={working.id} estimate={working} priceBook={priceBook} normSet={normSet} generalConditions={generalConditions} templates={templates} wiki={wiki} logoDataUrl={logoDataUrl} footer={footer} />
      ) : (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-surface py-16 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> {loading ? "Loading estimate…" : "Preparing…"}
        </div>
      )}
    </div>
  );
}
