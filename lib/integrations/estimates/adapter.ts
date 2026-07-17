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
import { estimateTotals } from "@/lib/estimates/calc";
import type { EstimateStatus } from "@/lib/data/estimates.types";

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
