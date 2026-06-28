/**
 * CostDataProvider abstraction.
 *
 * Each provider describes HOW cost data enters the system and under what licence.
 * Per the integration strategy, Dutch licensed providers are NOT assumed to have
 * open APIs — they start as licensed import templates and only become API
 * connectors if/when the provider grants access. `integrationPhase` records that.
 */

import type { ProviderType, ConfidenceLevel } from "./types";

export type ProviderCapability =
  | "browse"
  | "csv_import"
  | "excel_import"
  | "json_import"
  | "api_sync"
  | "index_feed"
  | "manual_entry";

export type LicensingModel = "free" | "subscription" | "one_time" | "quote";
export type BillingCycle = "monthly" | "annual" | "one_time" | "n/a";

/**
 * Licensing cost guidance per provider.
 *
 * ⚠️ LICENSING ESTIMATES BELOW ARE UNVERIFIED PLACEHOLDERS. ⚠️
 * The Dutch vendors (BouwkostenKompas, BDB, Archidat) do not publish fixed public
 * pricing — figures are rough order-of-magnitude only, for budgeting/triage.
 * `verified: false` ⇒ confirm with the vendor before committing. Adjust / delete /
 * modify these in one place: the `licensing` field on each provider in PROVIDERS.
 */
export type ProviderLicensing = {
  model: LicensingModel;
  billing: BillingCycle;
  estAmountMin?: number; // UNVERIFIED estimate
  estAmountMax?: number; // UNVERIFIED estimate
  currency?: string;
  verified: boolean; // false = needs a real quote
  recommendation: "keep" | "evaluate" | "eliminate";
  note: string;
};

export type CostDataProvider = {
  id: string;
  providerName: string;
  providerType: ProviderType;
  country: string;
  currency: string;
  licenseRequired: boolean;
  updateFrequency: string;
  sourceReferenceUrl: string;
  lastSyncDate: string | null;
  confidenceLevel: ConfidenceLevel;
  capabilities: ProviderCapability[];
  /** Integration roadmap phase (1=manual/CSV … 4=direct API … 5=reseller). */
  integrationPhase: 1 | 2 | 3 | 4 | 5;
  description: string;
  licensing: ProviderLicensing;
};

export const PROVIDERS: CostDataProvider[] = [
  {
    id: "internal-zenarch",
    providerName: "Internal ZenArch Cost DB",
    providerType: "manual_entry",
    country: "ALL",
    currency: "USD",
    licenseRequired: false,
    updateFrequency: "continuous",
    sourceReferenceUrl: "",
    lastSyncDate: "2026-06-18",
    confidenceLevel: "high",
    capabilities: ["browse", "manual_entry", "csv_import", "excel_import"],
    integrationPhase: 1,
    description: "Firm-owned reference prices and historical project actuals. Fully owned — no licence restrictions.",
    // LICENSING — owned data, no cost. (edit here)
    licensing: { model: "free", billing: "n/a", currency: "USD", verified: true, recommendation: "keep", note: "Owned by ZenArch — no licence fee." },
  },
  {
    id: "manual",
    providerName: "Manual Cost Entry",
    providerType: "manual_entry",
    country: "ALL",
    currency: "USD",
    licenseRequired: false,
    updateFrequency: "on demand",
    sourceReferenceUrl: "",
    lastSyncDate: null,
    confidenceLevel: "medium",
    capabilities: ["manual_entry"],
    integrationPhase: 1,
    description: "Estimator-entered prices for one-off items.",
    // LICENSING — none. (edit here)
    licensing: { model: "free", billing: "n/a", currency: "USD", verified: true, recommendation: "keep", note: "No licence — manual entry." },
  },
  {
    id: "cbs-public",
    providerName: "CBS / Data Overheid (public index)",
    providerType: "public_dataset",
    country: "NL",
    currency: "EUR",
    licenseRequired: false,
    updateFrequency: "monthly",
    sourceReferenceUrl: "https://opendata.cbs.nl",
    lastSyncDate: "2026-05-01",
    confidenceLevel: "high",
    capabilities: ["index_feed", "api_sync"],
    integrationPhase: 2,
    description: "Public Dutch government construction-cost indices for benchmark indexation and trend validation.",
    // LICENSING — public open data, free. (edit here)
    licensing: { model: "free", billing: "n/a", currency: "EUR", verified: true, recommendation: "keep", note: "CBS / Data Overheid open data — free to use with attribution. Best free baseline for indexation." },
  },
  {
    id: "bouwkostenkompas",
    providerName: "BouwkostenKompas",
    providerType: "csv_import",
    country: "NL",
    currency: "EUR",
    licenseRequired: true,
    updateFrequency: "licensed sync",
    sourceReferenceUrl: "https://www.bouwkostenkompas.nl",
    lastSyncDate: null,
    confidenceLevel: "high",
    capabilities: ["csv_import", "excel_import", "browse"],
    integrationPhase: 3,
    description: "Licensed Dutch cost database — 20 sectors, 1,000+ cost key figures. Imported by licensed users only; not bundled.",
    // LICENSING ESTIMATE — UNVERIFIED. No public price list; per-seat annual subscription. Request quote. (edit/delete here)
    licensing: { model: "subscription", billing: "annual", estAmountMin: 1500, estAmountMax: 3500, currency: "EUR", verified: false, recommendation: "evaluate", note: "Rough estimate only — request a quote. Per-seat annual licence. Consider deferring for MVP (use CBS + internal)." },
  },
  {
    id: "bdb",
    providerName: "BDB Bouw(kosten)data",
    providerType: "csv_import",
    country: "NL",
    currency: "EUR",
    licenseRequired: true,
    updateFrequency: "subscription",
    sourceReferenceUrl: "https://www.bdb.nl",
    lastSyncDate: null,
    confidenceLevel: "high",
    capabilities: ["index_feed", "csv_import"],
    integrationPhase: 3,
    description: "Licensed Dutch cost-index & tender-market data for indexation and replacement-cost indexing. One-time or subscription products.",
    // LICENSING ESTIMATE — UNVERIFIED. Subscription index data + one-time datasets. Request quote. (edit/delete here)
    licensing: { model: "subscription", billing: "annual", estAmountMin: 1000, estAmountMax: 5000, currency: "EUR", verified: false, recommendation: "evaluate", note: "Rough estimate — request quote. One-time dataset purchases also available (cheaper if only indices needed). May be substitutable by free CBS index for MVP." },
  },
  {
    id: "archidat",
    providerName: "Archidat Bouwkosten / ArchiCalc",
    providerType: "csv_import",
    country: "NL",
    currency: "EUR",
    licenseRequired: true,
    updateFrequency: "licensed sync",
    sourceReferenceUrl: "https://www.archidat.nl",
    lastSyncDate: null,
    confidenceLevel: "high",
    capabilities: ["csv_import", "excel_import", "browse"],
    integrationPhase: 3,
    description: "Licensed element prices & 5D key figures (residential, renovation, utility). Imported via licensed templates.",
    // LICENSING ESTIMATE — UNVERIFIED. Archidat Bouwkosten online subscription (ArchiCalc). Request quote. (edit/delete here)
    licensing: { model: "subscription", billing: "annual", estAmountMin: 1200, estAmountMax: 4000, currency: "EUR", verified: false, recommendation: "evaluate", note: "Rough estimate — request quote. Online subscription; monthly billing may be offered. Strongest for elemental/5D — keep if you do NL elemental estimates." },
  },
];

export const providerById = (id: string): CostDataProvider | undefined => PROVIDERS.find((p) => p.id === id);

/**
 * MVP scope switch. While true, the app runs on FREE sources only
 * (CBS public index + internal/manual). Licensed Dutch connectors
 * (BouwkostenKompas, BDB, Archidat) are deferred — flip to false to enable them.
 */
export const MVP_FREE_ONLY = true;

export const isProviderActive = (p: CostDataProvider): boolean => !MVP_FREE_ONLY || !p.licenseRequired;
export const ACTIVE_PROVIDERS = PROVIDERS.filter(isProviderActive);
export const DEFERRED_PROVIDERS = PROVIDERS.filter((p) => !isProviderActive(p));
