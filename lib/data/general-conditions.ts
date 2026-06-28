/**
 * General Conditions (preliminaries) — project-wide indirect costs that aren't
 * tied to a single work item: insurance, site facilities, utilities, etc.
 *
 * The total of the enabled items feeds the estimate's optional "General Conditions"
 * line (added after Direct Cost, before Profit/Overhead). Editable per project.
 */

export type GeneralConditionItem = {
  id: string;
  name: string;
  unit: string; // ls | month | week | no …
  qty: number;
  unitCost: number;
  note?: string;
  enabled: boolean;
};

export const GENERAL_CONDITIONS_SEED: GeneralConditionItem[] = [
  { id: "gc-car", name: "CAR — Construction All Risk insurance", unit: "ls", qty: 1, unitCost: 8500, note: "policy premium", enabled: true },
  { id: "gc-mob", name: "Mobilization / Demobilization", unit: "ls", qty: 1, unitCost: 5000, enabled: true },
  { id: "gc-office", name: "Site office (incl. furniture)", unit: "month", qty: 6, unitCost: 1200, enabled: true },
  { id: "gc-power", name: "Temporary power & water", unit: "month", qty: 6, unitCost: 600, enabled: true },
  { id: "gc-fuel", name: "Fuel & lubricants", unit: "month", qty: 6, unitCost: 900, enabled: true },
  { id: "gc-water", name: "Drinking water & ice", unit: "month", qty: 6, unitCost: 250, enabled: true },
  { id: "gc-porta", name: "Porta-potty / sanitation", unit: "month", qty: 6, unitCost: 350, enabled: true },
  { id: "gc-security", name: "Site security", unit: "month", qty: 6, unitCost: 1500, enabled: true },
  { id: "gc-clean", name: "Site cleaning & waste removal", unit: "month", qty: 6, unitCost: 400, enabled: true },
  { id: "gc-safety", name: "Safety, PPE & first aid", unit: "ls", qty: 1, unitCost: 2500, enabled: true },
  { id: "gc-sign", name: "Signage & hoarding", unit: "ls", qty: 1, unitCost: 1800, enabled: false },
];

export const sumGeneralConditions = (items: GeneralConditionItem[]): number =>
  items.filter((g) => g.enabled).reduce((a, g) => a + g.qty * g.unitCost, 0);
