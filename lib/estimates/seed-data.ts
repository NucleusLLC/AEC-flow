/**
 * Cost-Estimation seed data — the demo estimates loaded by `prisma db seed`.
 * EST-2026-014 carries the full BOQ (categories + line items); the others are
 * header-only until edited. `amount` is the indicative grand total shown in the
 * estimate list. Aruba/USD context, project numbers match lib/data/projects.
 */
import type { CostEstimate } from "@/lib/data/estimates.types";

export type SeedEstimate = CostEstimate & { amount: number };

export const SEED_ESTIMATES: SeedEstimate[] = [
  {
    id: "EST-2026-014",
    projectId: "ZA-2026-014",
    projectNumber: "ZA-2026-014",
    projectName: "Marina Heights Tower — Phase 2",
    client: "Aruba Investment Group",
    location: "Oranjestad, Aruba",
    version: "V1.0",
    date: "2026-06-18",
    currency: "USD",
    avgLaborRate: 45,
    profitPct: 24,
    bboPct: 7,
    gfa: 12000,
    status: "in_review",
    amount: 3960000,
    categories: [
      {
        id: "c-foundation",
        name: "Foundation",
        code: "A10",
        items: [
          { id: "i1", task: "Excavation for foundations", qty: 850, unit: "m³", laborNorm: 0.35, materialUnitCost: 0, equipmentUnitCost: 12, subcontractUnitCost: 0, poc: 100, code: "EQ-EXC" },
          { id: "i2", task: "Blinding / lean concrete", qty: 45, unit: "m³", laborNorm: 1.2, materialUnitCost: 380, equipmentUnitCost: 8, subcontractUnitCost: 0, poc: 100, code: "CON-LEAN" },
          { id: "i3", task: "Reinforced concrete footings", qty: 220, unit: "m³", laborNorm: 3.5, materialUnitCost: 520, equipmentUnitCost: 15, subcontractUnitCost: 0, poc: 95, code: "CON-C30" },
          { id: "i4", task: "Reinforcement steel (rebar)", qty: 28, unit: "ton", laborNorm: 16, materialUnitCost: 2800, equipmentUnitCost: 0, subcontractUnitCost: 0, poc: 90, code: "RFT-B500" },
          { id: "i5", task: "Formwork to footings", qty: 600, unit: "m²", laborNorm: 0.9, materialUnitCost: 75, equipmentUnitCost: 0, subcontractUnitCost: 0, poc: 100, code: "FRM-PLY" },
          { id: "i6", task: "Waterproofing to foundations", qty: 720, unit: "m²", laborNorm: 0.25, materialUnitCost: 45, equipmentUnitCost: 0, subcontractUnitCost: 35, poc: 80, code: "WP-MEMB" },
        ],
      },
      {
        id: "c-columns",
        name: "Columns & Beams",
        code: "B10",
        items: [
          { id: "i7", task: "RC columns", qty: 65, unit: "m³", laborNorm: 4.5, materialUnitCost: 540, equipmentUnitCost: 18, subcontractUnitCost: 0, poc: 70, code: "CON-C40" },
          { id: "i8", task: "Formwork to columns", qty: 420, unit: "m²", laborNorm: 1.1, materialUnitCost: 85, equipmentUnitCost: 0, subcontractUnitCost: 0, poc: 75, code: "FRM-PLY" },
          { id: "i9", task: "RC beams", qty: 95, unit: "m³", laborNorm: 4.2, materialUnitCost: 535, equipmentUnitCost: 16, subcontractUnitCost: 0, poc: 55, code: "CON-C40" },
        ],
      },
      {
        id: "c-slabs",
        name: "Suspended Slabs",
        code: "B10",
        items: [
          { id: "i10", task: "RC suspended slab", qty: 180, unit: "m³", laborNorm: 4.0, materialUnitCost: 530, equipmentUnitCost: 20, subcontractUnitCost: 0, poc: 40, code: "CON-C40" },
          { id: "i11", task: "Formwork to slabs", qty: 1600, unit: "m²", laborNorm: 0.8, materialUnitCost: 70, equipmentUnitCost: 0, subcontractUnitCost: 0, poc: 45, code: "FRM-PLY" },
        ],
      },
      {
        id: "c-blockwork",
        name: "Blockwork & Plaster",
        code: "C10",
        items: [
          { id: "i12", task: "200mm block walls", qty: 2400, unit: "m²", laborNorm: 0.6, materialUnitCost: 55, equipmentUnitCost: 0, subcontractUnitCost: 0, poc: 20, code: "BLK-200" },
          { id: "i13", task: "Internal plaster", qty: 4800, unit: "m²", laborNorm: 0.35, materialUnitCost: 18, equipmentUnitCost: 0, subcontractUnitCost: 0, poc: 10, code: "PLS-CEM" },
        ],
      },
      {
        id: "c-finishes",
        name: "Finishes",
        code: "C30",
        items: [
          { id: "i14", task: "Floor tiling", qty: 1800, unit: "m²", laborNorm: 0.5, materialUnitCost: 90, equipmentUnitCost: 0, subcontractUnitCost: 0, poc: 0, code: "TIL-POR" },
          { id: "i15", task: "Painting", qty: 5200, unit: "m²", laborNorm: 0.2, materialUnitCost: 12, equipmentUnitCost: 0, subcontractUnitCost: 0, poc: 0, code: "PNT-EMUL" },
          { id: "i16", task: "Aluminium glazing (supply & install)", qty: 320, unit: "m²", laborNorm: 0, materialUnitCost: 0, equipmentUnitCost: 0, subcontractUnitCost: 650, poc: 0, code: "GLZ-ALU" },
        ],
      },
    ],
  },
  { id: "EST-2026-011", projectId: "ZA-2026-011", projectNumber: "ZA-2026-011", projectName: "Eagle Beach Villas (6 units)", client: "Sunset Developments NV", location: "Eagle Beach, Aruba", version: "V2.1", date: "2026-05-30", currency: "USD", avgLaborRate: 45, profitPct: 24, bboPct: 7, status: "approved", amount: 5420000, categories: [] },
  { id: "EST-2026-018", projectId: "ZA-2026-018", projectNumber: "ZA-2026-018", projectName: "Downtown Office Renovation", client: "ABC Corporate Services", location: "Caya G.F. Betico Croes, Oranjestad", version: "V1.2", date: "2026-06-10", currency: "USD", avgLaborRate: 45, profitPct: 24, bboPct: 7, status: "draft", amount: 880000, categories: [] },
  { id: "EST-2026-008", projectId: "ZA-2026-008", projectNumber: "ZA-2026-008", projectName: "Palm Plaza Retail Center", client: "Palm Holdings Ltd", location: "Palm Beach, Noord", version: "V1.0", date: "2026-04-22", currency: "USD", avgLaborRate: 45, profitPct: 24, bboPct: 7, status: "in_review", amount: 7150000, categories: [] },
  { id: "EST-2026-005", projectId: "ZA-2026-005", projectNumber: "ZA-2026-005", projectName: "Noord Community Center", client: "Government of Aruba — DOW", location: "Noord, Aruba", version: "V3.0", date: "2026-03-15", currency: "USD", avgLaborRate: 45, profitPct: 24, bboPct: 7, status: "approved", amount: 2310000, categories: [] },
  { id: "EST-2025-031", projectId: "ZA-2025-031", projectNumber: "ZA-2025-031", projectName: "Savaneta Private Residence", client: "Private Client", location: "Savaneta, Aruba", version: "V1.1", date: "2025-12-09", currency: "USD", avgLaborRate: 45, profitPct: 24, bboPct: 7, status: "draft", amount: 640000, categories: [] },
];
