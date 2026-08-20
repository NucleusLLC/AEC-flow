"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import type { CostEstimate, EstimateProject } from "@/lib/data/estimates";
import type { PriceItem } from "@/lib/data/price-lists.types";
import type { NormSetTask, EstimateTemplate } from "@/lib/data/estimate-presets";
import type { GeneralConditionItem } from "@/lib/data/general-conditions";
import type { WikiArticle } from "@/lib/data/estimating-wiki";
import { getSystemCurrency } from "@/lib/format";
import type { FooterSettings } from "@/lib/server/practice-config";
import { loadEstimateAction } from "@/app/(app)/estimates/actions";
/* LOADING UI ONLY (approved 2026-08-20). Replaces the indeterminate spinner that
 * "looked stuck". Nothing below reads, writes, saves or reshapes an estimate —
 * the signal is a write-only progress record the loader polls. */
import { ProgressLoader, createLoadSignal, advanceLoadSignal, type LoadSignal } from "@/components/ui/progress-loader";
import { OPEN_ESTIMATE_STAGES } from "@/lib/ui/progress-loader";
import { ProjectListView } from "./project-list-view";
import { EstimateWorkspace } from "./estimate-workspace";

type PriceBook = { materials: PriceItem[]; equipment: PriceItem[] };

export function EstimatesApp({ projects, startProjects, clients, initialProjectId, baseEstimate, priceBook, normSet, generalConditions, templates, wiki, logoDataUrl, footer }: { projects: EstimateProject[]; startProjects?: EstimateProject[]; /** Clients a project created inline can be filed under. */ clients?: { id: string; name: string }[]; initialProjectId?: string; baseEstimate: CostEstimate; priceBook: PriceBook; normSet: NormSetTask[]; generalConditions: GeneralConditionItem[]; templates: EstimateTemplate[]; wiki: WikiArticle[]; logoDataUrl?: string | null; footer?: FooterSettings }) {
  const [selected, setSelected] = useState<EstimateProject | null>(null);
  // The selected estimate's OWN persisted sheet (loaded by id), not the base seed.
  const [working, setWorking] = useState<CostEstimate | null>(null);
  const [, startLoad] = useTransition();
  /* A load that came back empty for an estimate that EXISTS. Kept separate from
   * `working` so the sheet is never mounted on invented data — see below. */
  const [loadFailed, setLoadFailed] = useState<EstimateProject | null>(null);
  /* DISPLAY ONLY. What the load has actually got done so far, for the progress
   * bar. A ref and not state on purpose: an update made after an `await` inside
   * a transition is batched with the final one, so a "fetch finished" state
   * change would never be rendered. Nothing reads this except <ProgressLoader />.
   *
   * Seeded with epoch 0 rather than the clock: this initial value is never
   * displayed (the loader only renders once `selected` is set, and `openProject`
   * replaces the signal before that), and reading a clock during render is
   * impure. `openProject` puts the real timestamp in. */
  const progress = useRef<LoadSignal>(createLoadSignal(0));

  const openProject = (p: EstimateProject) => {
    setSelected(p);
    setWorking(null);
    setLoadFailed(null);
    progress.current = createLoadSignal();
    /* Is this a NEW estimate (a project with no sheet yet) or an EXISTING one?
     * It decides what a null load MEANS, and getting that wrong destroys data. */
    const isNew = (startProjects ?? []).some((sp) => sp.id === p.id);
    startLoad(async () => {
      const est = await loadEstimateAction(p.id);

      /* THE RULE: never invent a sheet for an estimate that exists.
       *
       * This used to fall through to a blank sheet whenever the load returned
       * null, on the assumption that "the id should always resolve". When that
       * assumption broke, the editor mounted on an empty sheet and its 2.5-second
       * autosave wrote the emptiness back — silently replacing a real BOQ with
       * one placeholder line. An estimate was hollowed out that way twice on
       * 2026-08-20. A failed load is an error to be shown, not a blank page to be
       * filled in and saved. */
      if (!est && !isNew) {
        setLoadFailed(p);
        return;
      }

      /* DISPLAY ONLY — stage 1 (the server round trip) is genuinely finished at
       * this line, which is why the bar is allowed to cross into stage 2 here
       * and nowhere else. The counts are read off the payload we already have;
       * nothing is fetched, changed or saved. */
      const sections = est?.categories.length ?? 0;
      const lines = est?.categories.reduce((n, c) => n + c.items.length, 0) ?? 0;
      advanceLoadSignal(progress.current, 1, est ? `${sections} sections · ${lines} lines` : "new sheet");

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
      ) : loadFailed ? (
        /* Deliberately offers Retry and nothing else. No editable sheet is
         * mounted, so there is nothing for the autosave to overwrite the stored
         * estimate with. The data is intact on the server; only this load failed. */
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-amber-300 bg-amber-50 py-16 text-center">
          <p className="text-sm font-medium text-amber-900">This estimate could not be loaded.</p>
          <p className="max-w-md text-xs text-amber-800">
            Your saved figures are safe — nothing has been changed. The editor stays closed on purpose,
            so an incomplete load cannot overwrite them. Try again, and tell your administrator if it persists.
          </p>
          <button
            type="button"
            onClick={() => openProject(loadFailed)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100"
          >
            Try again
          </button>
        </div>
      ) : (
        /* Same branch as before — this is still only reached when there is no
         * sheet and no failure, so the guard above keeps its precedence. Only
         * the contents changed: a determinate bar driven by the two stages the
         * load really has, instead of a spinner that looked stuck. */
        <ProgressLoader signal={progress.current} stages={OPEN_ESTIMATE_STAGES} title="Loading estimate" />
      )}
    </div>
  );
}
