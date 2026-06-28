/**
 * Cost-Estimation — client-safe declarations (types + units).
 *
 * Split out of `lib/data/estimates.ts` so client components can import the
 * shapes/constants WITHOUT transitively pulling in Prisma (`@/lib/db` → pg →
 * dns), which would break the browser bundle. The Prisma-backed data layer
 * (`estimates.ts`) re-exports everything here via `export *`, so server call
 * sites importing from "@/lib/data/estimates" keep working unchanged.
 * See [[aec-prisma-client-boundary]].
 */

export type EstimateStatus = "draft" | "in_review" | "approved";

/**
 * Per-line calculation method, resolved by the Method Resolver in
 * `lib/estimates/calc.ts`. Norm-Based is the default and current behavior;
 * Labor/Rate and Assembly-Based plug into the resolver without changing the
 * downstream total formula or the report column structure.
 */
export type CalculationMethod = "norm" | "labor_rate" | "assembly";

/** A typed component of an Assembly-Based line. Each is priced per assembly unit and
 *  distributes into the matching cost column. For "labor", `qty` is hours per assembly
 *  unit and `unitCost` is the hourly rate (so the component feeds labour hours). */
export type AssemblyComponentType = "labor" | "material" | "equipment" | "subcontract" | "other";

export type AssemblyComponent = {
  id: string;
  name: string;
  type: AssemblyComponentType;
  qty: number; // per assembly unit (labor: hours/unit)
  unitCost: number; // per component unit (labor: hourly rate)
};

export type EstimateItem = {
  id: string;
  task: string;
  qty: number;
  unit: string;
  laborNorm: number; // hours per unit
  materialUnitCost: number;
  equipmentUnitCost: number;
  subcontractUnitCost: number;
  poc: number; // percent of completion (0–100); Progress Amount = Item Total × POC%
  code?: string; // BOQ "Coding" — price-list reference code (Materials/Equipment price list)
  /** Calculation method for this line (defaults to Norm-Based when unset). */
  calculationMethod?: CalculationMethod;
  /**
   * Labor/Rate method only: direct labour cost per unit (currency/unit). Labor Cost =
   * qty × laborRatePerUnit. Hours still derive from `laborNorm`, so the Schedule Coupler
   * stays accurate (labour cost and labour hours are intentionally decoupled here).
   */
  laborRatePerUnit?: number;
  /** Assembly method only: the typed components that make up one assembly unit. */
  assembly?: AssemblyComponent[];
};

export type EstimateCategory = {
  id: string;
  name: string;
  code?: string; // section classification code (UniFormat element group, e.g. A10 Foundations)
  items: EstimateItem[];
};

export type CostEstimate = {
  id: string;
  projectId: string | null;
  projectNumber?: string | null;
  projectName: string;
  version: string;
  date: string;
  location: string;
  client?: string;
  currency: string;
  avgLaborRate: number; // per hour
  profitPct: number;
  bboPct: number;
  /** Gross built-up area in m² — drives the per-m² cost metrics in the summary. */
  gfa?: number;
  status?: EstimateStatus;
  /** Budget & Timeline config (schedule coupler + payment/retainage) — persisted as JSON. */
  budget?: EstimateBudget | null;
  categories: EstimateCategory[];
};

/** Persisted Budget & Timeline configuration for an estimate (see lib/estimates/budget-timeline). */
export type EstimateBudget = {
  schedule?: import("@/lib/estimates/budget-timeline").ScheduleConfig;
  payment?: import("@/lib/estimates/budget-timeline").PaymentConfig;
};

export const ESTIMATE_UNITS = ["m³", "m²", "m", "lm", "no", "kg", "ton", "ls", "set", "day"];

/* Estimate projects — the list shown when entering the Estimates area. */
export type EstimateProject = {
  id: string;
  projectNumber: string;
  projectName: string;
  address: string;
  client: string;
  version: string;
  date: string;
  currency: string;
  status: EstimateStatus;
  amount: number; // indicative grand total
};
