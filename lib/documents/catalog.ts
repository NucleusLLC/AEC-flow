/**
 * Document Generator catalog (client-safe — no Prisma).
 *
 * Enumerates the document types that can be generated FROM the protected
 * Estimates and Schedule systems (spec §12/§13). The generator does NOT contain
 * an estimate or schedule engine — a "backed" document is produced by opening the
 * EXISTING print route for the source record and recording the generation with
 * its source-version block. Types not yet backed by a renderer are marked
 * `backed: false` (planned) rather than faked.
 */
export type SourceSystem = "estimates" | "schedule";

export interface DocType {
  key: string;
  label: string;
  /** Backed by an existing renderer today (vs. planned). */
  backed: boolean;
}

export const SOURCE_LABEL: Record<SourceSystem, string> = {
  estimates: "Estimates",
  schedule: "Schedule",
};

/** Estimate document types (spec §12). Backed types render via the existing
 *  `/print/estimates/[id]` document; the rest are planned. */
export const ESTIMATE_DOCS: DocType[] = [
  { key: "detailed_estimate", label: "Detailed estimate", backed: true },
  { key: "cost_summary", label: "Cost summary", backed: true },
  { key: "boq", label: "Bill of Quantities (BOQ)", backed: true },
  { key: "client_quotation", label: "Client quotation", backed: true },
  { key: "preliminary_estimate", label: "Preliminary estimate", backed: false },
  { key: "contractor_quotation", label: "Contractor quotation", backed: false },
  { key: "material_summary", label: "Material summary", backed: false },
  { key: "labor_summary", label: "Labor summary", backed: false },
  { key: "equipment_summary", label: "Equipment summary", backed: false },
  { key: "estimate_assumptions", label: "Estimate assumptions", backed: false },
  { key: "estimate_exclusions", label: "Estimate exclusions", backed: false },
  { key: "cashflow_report", label: "Cash-flow report", backed: false },
  { key: "estimate_comparison", label: "Estimate comparison", backed: false },
  { key: "estimate_revision_report", label: "Estimate revision report", backed: false },
];

/** Schedule document types (spec §13). Backed types render via the existing
 *  `/print/schedule/[projectId]` programme sheet; the rest are planned. */
export const SCHEDULE_DOCS: DocType[] = [
  { key: "construction_schedule", label: "Construction schedule", backed: true },
  { key: "construction_timeframe_report", label: "Construction timeframe report", backed: true },
  { key: "gantt_report", label: "Gantt report", backed: true },
  { key: "activity_list", label: "Activity list", backed: false },
  { key: "milestone_report", label: "Milestone report", backed: false },
  { key: "look_ahead_report", label: "Look-ahead report", backed: false },
  { key: "critical_path_report", label: "Critical-path report", backed: false },
  { key: "schedule_status_report", label: "Schedule status report", backed: false },
  { key: "schedule_revision_comparison", label: "Schedule revision comparison", backed: false },
  { key: "procurement_timing_report", label: "Procurement timing report", backed: false },
];

export function docsFor(source: SourceSystem): DocType[] {
  return source === "estimates" ? ESTIMATE_DOCS : SCHEDULE_DOCS;
}

export function docLabel(source: SourceSystem, key: string): string {
  return docsFor(source).find((d) => d.key === key)?.label ?? key;
}

export function isSourceSystem(v: unknown): v is SourceSystem {
  return v === "estimates" || v === "schedule";
}
