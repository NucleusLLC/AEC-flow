/**
 * Seed data structure for the Cost-Data module (Aruba / Netherlands / Colombia / USA).
 *
 * Placeholder figures for wiring the UI and engines. Licensed-source rows here are
 * illustrative *structure* only — real licensed content arrives via user import.
 */

import type { CostSource, CostItem, CostIndex, RegionalAdjustment } from "./types";

const T = "2026-06-18T00:00:00Z";

export const COST_SOURCES: CostSource[] = [
  { id: "src-zenarch", name: "ZenArch Internal Cost DB", providerType: "manual_entry", country: "ALL", currency: "USD", licenseRequired: false, active: true, sourceUrl: "", createdAt: T, updatedAt: T },
  { id: "src-cbs", name: "CBS / Data Overheid (public index)", providerType: "public_dataset", country: "NL", currency: "EUR", licenseRequired: false, active: true, sourceUrl: "https://opendata.cbs.nl", createdAt: T, updatedAt: T },
  { id: "src-bouwkompas", name: "BouwkostenKompas", providerType: "csv_import", country: "NL", currency: "EUR", licenseRequired: true, licenseNotes: "Per-seat licence; import only.", active: false, sourceUrl: "https://www.bouwkostenkompas.nl", createdAt: T, updatedAt: T },
  { id: "src-bdb", name: "BDB Bouw(kosten)data", providerType: "csv_import", country: "NL", currency: "EUR", licenseRequired: true, licenseNotes: "Subscription index data.", active: false, sourceUrl: "https://www.bdb.nl", createdAt: T, updatedAt: T },
  { id: "src-archidat", name: "Archidat Bouwkosten / ArchiCalc", providerType: "csv_import", country: "NL", currency: "EUR", licenseRequired: true, licenseNotes: "Element prices / 5D key figures.", active: false, sourceUrl: "https://www.archidat.nl", createdAt: T, updatedAt: T },
];

export const COST_ITEMS: CostItem[] = [
  // Netherlands (illustrative element prices, EUR)
  { id: "ci-nl-1", sourceId: "src-zenarch", externalReferenceCode: "NL-FND-001", classificationSystem: "NL-SfB", classificationCode: "16", title: "Foundation — bored pile incl. reinforcement", unit: "m", baseQuantity: 1, baseCost: 78, currency: "EUR", costType: "composite", buildingCategory: "Residential", workCategory: "Substructure", elementCategory: "Foundations", includesVat: false, includesOverhead: false, includesProfit: false, effectiveDate: "2025-01-01", region: "NL", qualityLevel: "standard", dataConfidence: "high", createdAt: T, updatedAt: T },
  { id: "ci-nl-2", sourceId: "src-zenarch", externalReferenceCode: "NL-WAL-021", classificationSystem: "NL-SfB", classificationCode: "21", title: "External cavity wall — brick + insulation", unit: "m²", baseQuantity: 1, baseCost: 168, currency: "EUR", costType: "composite", buildingCategory: "Residential", workCategory: "Superstructure", elementCategory: "External walls", includesVat: false, includesOverhead: false, includesProfit: false, effectiveDate: "2025-01-01", region: "NL", qualityLevel: "standard", dataConfidence: "high", createdAt: T, updatedAt: T },
  { id: "ci-nl-3", sourceId: "src-zenarch", externalReferenceCode: "NL-RF-031", classificationSystem: "STABU", classificationCode: "27.21", title: "Flat roof — bitumen, insulated", unit: "m²", baseQuantity: 1, baseCost: 132, currency: "EUR", costType: "composite", buildingCategory: "Utility", workCategory: "Superstructure", elementCategory: "Roof", includesVat: false, includesOverhead: false, includesProfit: false, effectiveDate: "2025-01-01", region: "NL", qualityLevel: "standard", dataConfidence: "medium", createdAt: T, updatedAt: T },

  // Aruba (internal, USD)
  { id: "ci-ar-1", sourceId: "src-zenarch", externalReferenceCode: "AR-CON-001", classificationSystem: "ZenArch", classificationCode: "CONC.RMX", title: "Ready-mix concrete 3000 psi (APEX)", unit: "m³", baseQuantity: 1, baseCost: 138, currency: "USD", costType: "material", buildingCategory: "Residential", workCategory: "Concrete", elementCategory: "Structure", includesVat: false, includesOverhead: false, includesProfit: false, effectiveDate: "2026-06-01", region: "Aruba", qualityLevel: "standard", dataConfidence: "high", createdAt: T, updatedAt: T },
  { id: "ci-ar-2", sourceId: "src-zenarch", externalReferenceCode: "AR-BLK-008", classificationSystem: "ZenArch", classificationCode: "MAS.BLK8", title: 'Concrete block 8" wall (laid)', unit: "m²", baseQuantity: 1, baseCost: 34, currency: "USD", costType: "composite", buildingCategory: "Residential", workCategory: "Masonry", elementCategory: "External walls", includesVat: false, includesOverhead: false, includesProfit: false, effectiveDate: "2026-06-01", region: "Aruba", qualityLevel: "standard", dataConfidence: "high", createdAt: T, updatedAt: T },

  // Colombia (COP) & USA / Florida (USD)
  { id: "ci-co-1", sourceId: "src-zenarch", externalReferenceCode: "CO-CON-001", classificationSystem: "ZenArch", classificationCode: "CONC.RMX", title: "Concreto premezclado 21 MPa", unit: "m³", baseQuantity: 1, baseCost: 520000, currency: "COP", costType: "material", buildingCategory: "Residential", workCategory: "Concrete", elementCategory: "Structure", includesVat: false, includesOverhead: false, includesProfit: false, effectiveDate: "2026-03-01", region: "Bogotá", qualityLevel: "standard", dataConfidence: "medium", createdAt: T, updatedAt: T },
  { id: "ci-us-1", sourceId: "src-zenarch", externalReferenceCode: "US-CON-001", classificationSystem: "ZenArch", classificationCode: "CONC.RMX", title: "Ready-mix concrete 3000 psi", unit: "yd³", baseQuantity: 1, baseCost: 165, currency: "USD", costType: "material", buildingCategory: "Residential", workCategory: "Concrete", elementCategory: "Structure", includesVat: false, includesOverhead: false, includesProfit: false, effectiveDate: "2026-04-01", region: "Florida", qualityLevel: "standard", dataConfidence: "high", createdAt: T, updatedAt: T },
];

export const COST_INDEXES: CostIndex[] = [
  { id: "idx-cbs-2015", sourceId: "src-cbs", indexName: "CBS Construction cost — new dwellings", indexCategory: "construction", country: "NL", baseYear: 2015, indexDate: "2015-01-01", indexValue: 100, createdAt: T, updatedAt: T },
  { id: "idx-cbs-2025", sourceId: "src-cbs", indexName: "CBS Construction cost — new dwellings", indexCategory: "construction", country: "NL", baseYear: 2015, indexDate: "2025-12-01", indexValue: 137.4, percentageChangeYear: 4.1, percentageChangeMonth: 0.3, createdAt: T, updatedAt: T },
  { id: "idx-bdb-2025", sourceId: "src-bdb", indexName: "BDB Building cost index", indexCategory: "construction", country: "NL", baseYear: 2020, indexDate: "2025-12-01", indexValue: 124.8, percentageChangeYear: 3.6, createdAt: T, updatedAt: T },
];

export const REGIONAL_ADJUSTMENTS: RegionalAdjustment[] = [
  // NL base → Aruba (EUR → USD)
  { id: "ra-ar-mat", country: "Aruba", region: "Aruba", adjustmentType: "material", adjustmentFactor: 1.18, effectiveDate: "2026-01-01", notes: "Imported materials premium" },
  { id: "ra-ar-lab", country: "Aruba", region: "Aruba", adjustmentType: "labor", adjustmentFactor: 0.95, effectiveDate: "2026-01-01" },
  { id: "ra-ar-isl", country: "Aruba", region: "Aruba", adjustmentType: "island_factor", adjustmentFactor: 1.08, effectiveDate: "2026-01-01", notes: "Small-island overheads" },
  { id: "ra-ar-log", country: "Aruba", region: "Aruba", adjustmentType: "logistics", adjustmentFactor: 1.12, effectiveDate: "2026-01-01", notes: "Ocean freight & handling" },
  { id: "ra-ar-cur", country: "Aruba", region: "Aruba", adjustmentType: "currency", adjustmentFactor: 1.08, effectiveDate: "2026-06-01", notes: "EUR → USD" },
  // Curaçao
  { id: "ra-cw-isl", country: "Curaçao", region: "Curaçao", adjustmentType: "island_factor", adjustmentFactor: 1.10, effectiveDate: "2026-01-01" },
  { id: "ra-cw-log", country: "Curaçao", region: "Curaçao", adjustmentType: "logistics", adjustmentFactor: 1.14, effectiveDate: "2026-01-01" },
  { id: "ra-cw-cur", country: "Curaçao", region: "Curaçao", adjustmentType: "currency", adjustmentFactor: 1.08, effectiveDate: "2026-06-01", notes: "EUR → USD-pegged ANG" },
  // Bonaire
  { id: "ra-bo-isl", country: "Bonaire", region: "Bonaire", adjustmentType: "island_factor", adjustmentFactor: 1.12, effectiveDate: "2026-01-01" },
  { id: "ra-bo-log", country: "Bonaire", region: "Bonaire", adjustmentType: "logistics", adjustmentFactor: 1.16, effectiveDate: "2026-01-01" },
  { id: "ra-bo-cur", country: "Bonaire", region: "Bonaire", adjustmentType: "currency", adjustmentFactor: 1.08, effectiveDate: "2026-06-01", notes: "EUR → USD" },
  // Colombia
  { id: "ra-co-mat", country: "Colombia", region: "Bogotá", adjustmentType: "material", adjustmentFactor: 0.82, effectiveDate: "2026-01-01" },
  { id: "ra-co-lab", country: "Colombia", region: "Bogotá", adjustmentType: "labor", adjustmentFactor: 0.45, effectiveDate: "2026-01-01" },
  { id: "ra-co-log", country: "Colombia", region: "Bogotá", adjustmentType: "logistics", adjustmentFactor: 1.05, effectiveDate: "2026-01-01" },
  // Florida / USA
  { id: "ra-us-mat", country: "USA", region: "Florida", adjustmentType: "material", adjustmentFactor: 1.02, effectiveDate: "2026-01-01" },
  { id: "ra-us-lab", country: "USA", region: "Florida", adjustmentType: "labor", adjustmentFactor: 1.10, effectiveDate: "2026-01-01" },
  { id: "ra-us-cur", country: "USA", region: "Florida", adjustmentType: "currency", adjustmentFactor: 1.08, effectiveDate: "2026-06-01", notes: "EUR → USD" },
];

/** Distinct adjustment targets, for the regional selector. */
export const REGION_TARGETS = REGIONAL_ADJUSTMENTS.reduce<{ country: string; region: string }[]>((acc, a) => {
  if (!acc.some((x) => x.country === a.country && x.region === a.region)) acc.push({ country: a.country, region: a.region });
  return acc;
}, []);
