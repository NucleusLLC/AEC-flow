/**
 * Cost-Data module — normalized schema (TypeScript representation of the DB tables).
 *
 * These types mirror the planned Prisma/Postgres tables (snake_case columns map to
 * these camelCase fields). Everything is placeholder/in-memory until the DB lands;
 * the data-access layer keeps call sites stable for the SaaS conversion.
 *
 * Compliance: licensed third-party cost data (BouwkostenKompas, BDB, Archidat) is
 * NEVER scraped or bundled — it is imported/synced by licensed users only. See
 * ./compliance.ts and ./providers.ts.
 */

export type ProviderType = "api" | "csv_import" | "manual_entry" | "public_dataset";
export type CostType = "material" | "labor" | "equipment" | "subcontract" | "composite" | "index";
export type QualityLevel = "low" | "standard" | "high" | "luxury";
export type EstimateStatus = "draft" | "reviewed" | "approved" | "archived";
export type AdjustmentType = "labor" | "material" | "logistics" | "island_factor" | "inflation" | "currency";
export type ConfidenceLevel = "low" | "medium" | "high";
export type ClassificationSystem = "STABU" | "NL-SfB" | "IFC" | "Revit" | "ZenArch";

/** estimate_types — supported estimating methods. */
export type EstimateType =
  | "quick_m2"
  | "m3"
  | "elemental"
  | "detailed_boq"
  | "replacement_cost_new"
  | "insurance_replacement"
  | "appraisal_cost_approach"
  | "developer_feasibility";

/** cost_sources */
export type CostSource = {
  id: string;
  name: string;
  providerType: ProviderType;
  country: string;
  region?: string;
  currency: string;
  licenseRequired: boolean;
  licenseNotes?: string;
  sourceUrl?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

/** cost_items */
export type CostItem = {
  id: string;
  sourceId: string;
  externalReferenceCode?: string;
  classificationSystem?: ClassificationSystem;
  classificationCode?: string;
  title: string;
  descriptionShort?: string;
  buildingCategory?: string;
  workCategory?: string;
  elementCategory?: string;
  unit: string;
  baseQuantity: number;
  baseCost: number;
  currency: string;
  costType: CostType;
  includesVat: boolean;
  includesOverhead: boolean;
  includesProfit: boolean;
  effectiveDate: string;
  region?: string;
  qualityLevel: QualityLevel;
  dataConfidence: ConfidenceLevel;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

/** cost_indexes */
export type CostIndex = {
  id: string;
  sourceId: string;
  indexName: string;
  indexCategory: string;
  country: string;
  region?: string;
  baseYear: number;
  indexDate: string;
  indexValue: number;
  percentageChangeMonth?: number;
  percentageChangeYear?: number;
  createdAt: string;
  updatedAt: string;
};

/** project_estimates */
export type ProjectEstimate = {
  id: string;
  projectId: string | null;
  estimateName: string;
  country: string;
  region?: string;
  currency: string;
  estimateDate: string;
  buildingType?: string;
  grossFloorArea?: number;
  grossVolume?: number;
  qualityLevel: QualityLevel;
  estimateType: EstimateType;
  status: EstimateStatus;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
};

/** estimate_lines */
export type EstimateLine = {
  id: string;
  estimateId: string;
  costItemId?: string;
  customDescription?: string;
  quantity: number;
  unit: string;
  unitCost: number;
  subtotal: number;
  wastePercentage: number;
  overheadPercentage: number;
  profitPercentage: number;
  contingencyPercentage: number;
  vatPercentage: number;
  totalCost: number;
  notes?: string;
};

/** regional_adjustments */
export type RegionalAdjustment = {
  id: string;
  country: string;
  region: string;
  adjustmentType: AdjustmentType;
  adjustmentFactor: number;
  effectiveDate: string;
  notes?: string;
};
