/**
 * Estimates integration adapter (spec §8).
 *
 * READ-ONLY bridge between the module shell and the protected Estimates system.
 * It reuses the existing data-access layer and the single source-of-truth
 * calculation (`estimateTotals`) — it never recreates a calculation, never
 * writes, and never alters estimate behavior. See docs/protected-systems.md.
 */
import "server-only";
import { getEstimateById, getEstimateProjects } from "@/lib/data/estimates";
import { calcItem, categoryTotals, estimateTotals } from "@/lib/estimates/calc";
import type { EstimateStatus } from "@/lib/data/estimates.types";
import type { EstimateLine } from "@/lib/schedule/budget";

export interface EstimateSummary {
  found: boolean;
  estimateId: string;
  projectId: string | null;
  projectNumber: string;
  projectName: string;
  version: string;
  status: EstimateStatus;
  currency: string;
  locked: boolean;
  /** Grand total from the estimate's own calc (`estimateTotals`). */
  grandTotal: number;
  direct: number;
  /** Cost per m² (grand total ÷ built-up area), when GFA is set; else null. */
  costPerM2: number | null;
  gfa: number | null;
  date: string;
}

const NOT_FOUND: EstimateSummary = {
  found: false,
  estimateId: "",
  projectId: null,
  projectNumber: "",
  projectName: "",
  version: "",
  status: "draft",
  currency: "USD",
  locked: false,
  grandTotal: 0,
  direct: 0,
  costPerM2: null,
  gfa: null,
  date: "",
};

/** Resolve the estimate for a project. Estimates started from a project are
 *  keyed by the project id; otherwise fall back to a header match. */
async function resolveEstimateId(projectId: string): Promise<string | null> {
  const direct = await getEstimateById(projectId);
  if (direct) return direct.id;
  const headers = await getEstimateProjects();
  const match = headers.find((h) => h.projectNumber === projectId);
  return match?.id ?? null;
}

/** Build the summary from an already-loaded estimate (reuses `estimateTotals`). */
async function summaryFromId(id: string): Promise<EstimateSummary> {
  const est = await getEstimateById(id);
  if (!est) return NOT_FOUND;

  const totals = estimateTotals(est);
  const gfa = est.gfa ?? null;
  return {
    found: true,
    estimateId: est.id,
    projectId: est.projectId ?? null,
    projectNumber: est.projectNumber ?? "",
    projectName: est.projectName,
    version: est.version,
    status: est.status ?? "draft",
    currency: est.currency,
    locked: est.locked ?? false,
    grandTotal: totals.grandTotal,
    direct: totals.direct,
    costPerM2: gfa && gfa > 0 ? totals.grandTotal / gfa : null,
    gfa,
    date: est.date,
  };
}

/**
 * Read-only estimate summary for a project's dashboard tile. All monetary values
 * come from the estimate's own `estimateTotals` — no recalculation is performed
 * here. Returns `{ found: false }` when the project has no estimate (or it
 * belongs to another company — the tenant boundary in lib/db.ts hides it).
 */
export async function getProjectEstimateSummary(projectId: string): Promise<EstimateSummary> {
  const id = await resolveEstimateId(projectId);
  if (!id) return NOT_FOUND;
  return summaryFromId(id);
}

/** Read-only summary for a specific estimate record id. */
export async function getEstimateSummaryById(estimateId: string): Promise<EstimateSummary> {
  return summaryFromId(estimateId);
}

export interface EstimateListItem {
  estimateId: string;
  projectNumber: string;
  projectName: string;
  version: string;
  status: EstimateStatus;
  currency: string;
  /** Stored grand total (`CostEstimate.amount`) — no recompute. */
  amount: number;
  date: string;
}

/** Lightweight list of all estimates (uses the stored `amount`; no recompute). */
export async function getEstimateSummaries(): Promise<EstimateListItem[]> {
  const headers = await getEstimateProjects();
  return headers.map((h) => ({
    estimateId: h.id,
    projectNumber: h.projectNumber,
    projectName: h.projectName,
    version: h.version,
    status: h.status,
    currency: h.currency,
    amount: h.amount,
    date: h.date,
  }));
}

/**
 * The estimate, broken into pickable lines, for cost-loading a schedule.
 *
 * ADDED TO THE ADAPTER RATHER THAN REACHING PAST IT. The Schedule Budget panel needs
 * per-category and per-line amounts, which `getProjectEstimateSummary` does not carry.
 * Policy (docs/protected-systems.md) says a missing read is the adapter's job to add,
 * so it is added here instead of the schedule importing estimate internals.
 *
 * STILL STRICTLY READ-ONLY, AND STILL NOT A RECALCULATION. Every amount comes from the
 * estimate's own `categoryTotals` / `calcItem` at the estimate's own labour rate — the
 * same functions the estimate sheet itself renders from and that `npm run golden` pins.
 * Nothing here re-derives a cost, applies a markup, or writes anything.
 *
 * `direct` is the sum of the category lines. Profit and BBO are deliberately NOT
 * distributed onto the lines: they are whole-estimate markups with no per-category
 * meaning, and spreading them would manufacture a per-task figure the estimate never
 * asserted. The panel therefore reconciles task budgets against DIRECT cost and shows
 * the grand total separately.
 */
export interface EstimateBudgetSource {
  found: boolean;
  currency: string;
  grandTotal: number;
  direct: number;
  version: string;
  locked: boolean;
  lines: EstimateLine[];
}

const NO_SOURCE: EstimateBudgetSource = {
  found: false,
  currency: "USD",
  grandTotal: 0,
  direct: 0,
  version: "",
  locked: false,
  lines: [],
};

export async function getEstimateBudgetSource(projectId: string): Promise<EstimateBudgetSource> {
  const id = await resolveEstimateId(projectId);
  if (!id) return NO_SOURCE;
  const est = await getEstimateById(id);
  if (!est) return NO_SOURCE;

  const totals = estimateTotals(est);
  const rate = est.avgLaborRate;
  const lines: EstimateLine[] = [];
  for (const cat of est.categories) {
    const catRef = `cat:${cat.id}`;
    lines.push({
      ref: catRef,
      label: [cat.code, cat.name].filter(Boolean).join(" · ") || cat.name,
      kind: "category",
      parentRef: null,
      amount: categoryTotals(cat, rate).total,
    });
    for (const it of cat.items) {
      lines.push({
        ref: `item:${it.id}`,
        label: it.task,
        kind: "item",
        parentRef: catRef,
        amount: calcItem(it, rate).total,
      });
    }
  }

  return {
    found: true,
    currency: est.currency,
    grandTotal: totals.grandTotal,
    direct: totals.direct,
    version: est.version,
    locked: est.locked ?? false,
    lines,
  };
}

/** Stable URL into the existing Estimates system (routes unchanged). */
export function getEstimateRecordUrl(projectId?: string): string {
  return projectId ? `/estimates?project=${encodeURIComponent(projectId)}` : "/estimates";
}

/** The existing standalone printable estimate document (unchanged). */
export function getEstimatePrintUrl(
  estimateId: string,
  opts?: { gc?: boolean; usdRate?: number },
): string {
  const params = new URLSearchParams();
  if (opts?.gc) params.set("gc", "1");
  if (opts?.usdRate) params.set("usd", String(opts.usdRate));
  const qs = params.toString();
  return `/print/estimates/${encodeURIComponent(estimateId)}${qs ? `?${qs}` : ""}`;
}

/** Access is enforced by the tenant boundary (lib/db.ts) — cross-company reads
 *  return null. This hook is where per-user module entitlement would attach. */
export async function canAccess(): Promise<boolean> {
  return true;
}
