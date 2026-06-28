/**
 * Estimate presets — reusable building blocks for the cost-estimation sheet.
 *
 * Two libraries live here (single-tenant -> SaaS hedge: UI reads these via the
 * data layer, never inlining them):
 *
 *  1. NORM_SET ("Norm Set List") — standard tasks with a FIXED Norm Hrs/Unit
 *     (and typical unit costs). Picking one pre-fills a line item instantly.
 *  2. ESTIMATE_TEMPLATES — whole pre-made estimates (categories + items) such as
 *     AEC.Traditional1LevelHouse / AEC.ICF2LevelHouse. Users can save their own.
 *
 * Live version persists custom entries per firm; placeholder/static for now.
 */

import type { EstimateItem } from "./estimates";

/* ------------------------------------------------------------------ */
/* 1. Norm Set List — fixed Norm Hrs/Unit per standard task            */
/* ------------------------------------------------------------------ */

export type NormSetTask = {
  id: string;
  trade: string; // grouping for the dropdown (optgroup label)
  task: string;
  unit: string;
  laborNorm: number; // FIXED hours per unit — the value this list exists to lock in
  materialUnitCost?: number;
  equipmentUnitCost?: number;
  subcontractUnitCost?: number;
  code?: string; // price-list reference code (carried onto line items)
};

export const NORM_SET: NormSetTask[] = [
  // Earthworks
  { id: "n-exc", trade: "Earthworks", task: "Excavation for foundations", unit: "m³", laborNorm: 0.35, equipmentUnitCost: 12 },
  { id: "n-bkf", trade: "Earthworks", task: "Backfilling & compaction", unit: "m³", laborNorm: 0.25, equipmentUnitCost: 6 },
  { id: "n-hard", trade: "Earthworks", task: "Hardcore / sub-base", unit: "m³", laborNorm: 0.4, materialUnitCost: 65, equipmentUnitCost: 5 },

  // Concrete
  { id: "n-blind", trade: "Concrete", task: "Blinding / lean concrete", unit: "m³", laborNorm: 1.2, materialUnitCost: 380, equipmentUnitCost: 8 },
  { id: "n-foot", trade: "Concrete", task: "RC footings", unit: "m³", laborNorm: 3.5, materialUnitCost: 520, equipmentUnitCost: 15 },
  { id: "n-col", trade: "Concrete", task: "RC columns", unit: "m³", laborNorm: 4.5, materialUnitCost: 540, equipmentUnitCost: 18 },
  { id: "n-beam", trade: "Concrete", task: "RC beams", unit: "m³", laborNorm: 4.2, materialUnitCost: 535, equipmentUnitCost: 16 },
  { id: "n-slab", trade: "Concrete", task: "RC suspended slab", unit: "m³", laborNorm: 4.0, materialUnitCost: 530, equipmentUnitCost: 20 },
  { id: "n-sog", trade: "Concrete", task: "RC slab on grade", unit: "m²", laborNorm: 0.5, materialUnitCost: 95, equipmentUnitCost: 4 },

  // Reinforcement
  { id: "n-rebar", trade: "Reinforcement", task: "Reinforcement steel (rebar)", unit: "ton", laborNorm: 16, materialUnitCost: 2800 },
  { id: "n-mesh", trade: "Reinforcement", task: "Welded mesh fabric", unit: "m²", laborNorm: 0.12, materialUnitCost: 22 },

  // Formwork
  { id: "n-fw-foot", trade: "Formwork", task: "Formwork to footings", unit: "m²", laborNorm: 0.9, materialUnitCost: 75 },
  { id: "n-fw-col", trade: "Formwork", task: "Formwork to columns", unit: "m²", laborNorm: 1.1, materialUnitCost: 85 },
  { id: "n-fw-beam", trade: "Formwork", task: "Formwork to beams", unit: "m²", laborNorm: 1.2, materialUnitCost: 88 },
  { id: "n-fw-slab", trade: "Formwork", task: "Formwork to slabs", unit: "m²", laborNorm: 0.8, materialUnitCost: 70 },

  // Masonry
  { id: "n-blk200", trade: "Masonry", task: "200mm block walls", unit: "m²", laborNorm: 0.6, materialUnitCost: 55 },
  { id: "n-blk100", trade: "Masonry", task: "100mm block walls", unit: "m²", laborNorm: 0.5, materialUnitCost: 42 },

  // ICF (insulated concrete formwork)
  { id: "n-icf-wall", trade: "ICF", task: "ICF wall system (supply & install)", unit: "m²", laborNorm: 0.8, materialUnitCost: 210 },
  { id: "n-icf-fill", trade: "ICF", task: "ICF concrete fill", unit: "m³", laborNorm: 1.0, materialUnitCost: 530, equipmentUnitCost: 18 },

  // Waterproofing
  { id: "n-wp-found", trade: "Waterproofing", task: "Waterproofing to foundations", unit: "m²", laborNorm: 0.25, materialUnitCost: 45, subcontractUnitCost: 35 },
  { id: "n-wp-roof", trade: "Waterproofing", task: "Roof waterproofing membrane", unit: "m²", laborNorm: 0.3, materialUnitCost: 60, subcontractUnitCost: 40 },

  // Plaster & render
  { id: "n-plast", trade: "Plaster & Render", task: "Internal plaster", unit: "m²", laborNorm: 0.35, materialUnitCost: 18 },
  { id: "n-rend", trade: "Plaster & Render", task: "External render", unit: "m²", laborNorm: 0.45, materialUnitCost: 22 },

  // Finishes
  { id: "n-tile-fl", trade: "Finishes", task: "Floor tiling", unit: "m²", laborNorm: 0.5, materialUnitCost: 90 },
  { id: "n-tile-wl", trade: "Finishes", task: "Wall tiling", unit: "m²", laborNorm: 0.6, materialUnitCost: 85 },
  { id: "n-paint-in", trade: "Finishes", task: "Painting (internal)", unit: "m²", laborNorm: 0.2, materialUnitCost: 12 },
  { id: "n-paint-ex", trade: "Finishes", task: "Painting (external)", unit: "m²", laborNorm: 0.25, materialUnitCost: 16 },
  { id: "n-ceil", trade: "Finishes", task: "Gypsum board ceiling", unit: "m²", laborNorm: 0.4, materialUnitCost: 55 },

  // Joinery & glazing
  { id: "n-glaz", trade: "Joinery & Glazing", task: "Aluminium glazing (supply & install)", unit: "m²", laborNorm: 0, subcontractUnitCost: 650 },
  { id: "n-door", trade: "Joinery & Glazing", task: "Internal doors (supply & install)", unit: "no", laborNorm: 2.5, materialUnitCost: 850 },

  // MEP (subcontract)
  { id: "n-elec", trade: "MEP", task: "Electrical first & second fix", unit: "m²", laborNorm: 0, subcontractUnitCost: 120 },
  { id: "n-plumb", trade: "MEP", task: "Plumbing & drainage", unit: "m²", laborNorm: 0, subcontractUnitCost: 95 },
  { id: "n-hvac", trade: "MEP", task: "HVAC (split units)", unit: "no", laborNorm: 0, subcontractUnitCost: 2200 },
];

/** Distinct trade groups, in first-seen order — used to build dropdown optgroups. */
export const NORM_TRADES = NORM_SET.reduce<string[]>((acc, n) => {
  if (!acc.includes(n.trade)) acc.push(n.trade);
  return acc;
}, []);

/**
 * Price-list reference code per norm task (BOQ "Coding"). Most map to a real
 * Materials/Equipment price-list code; subcontract trades use SC-* codes.
 */
export const NORM_CODE: Record<string, string> = {
  "n-exc": "EQ-EXC", "n-bkf": "EQ-ROLL", "n-hard": "AGG-20",
  "n-blind": "CON-LEAN", "n-foot": "CON-C30", "n-col": "CON-C40", "n-beam": "CON-C40",
  "n-slab": "CON-C40", "n-sog": "CON-C30",
  "n-rebar": "RFT-B500", "n-mesh": "RFT-MESH",
  "n-fw-foot": "FRM-PLY", "n-fw-col": "FRM-PLY", "n-fw-beam": "FRM-PLY", "n-fw-slab": "FRM-PLY",
  "n-blk200": "BLK-200", "n-blk100": "BLK-100",
  "n-icf-wall": "ICF-FORM", "n-icf-fill": "CON-C30",
  "n-wp-found": "WP-MEMB", "n-wp-roof": "WP-MEMB",
  "n-plast": "PLS-CEM", "n-rend": "PLS-CEM",
  "n-tile-fl": "TIL-POR", "n-tile-wl": "TIL-CER",
  "n-paint-in": "PNT-EMUL", "n-paint-ex": "PNT-EXT", "n-ceil": "GYP-CEIL",
  "n-glaz": "GLZ-ALU", "n-door": "DR-INT",
  "n-elec": "SC-ELE", "n-plumb": "SC-PLM", "n-hvac": "SC-HVAC",
};

/** Code for a norm-set id (empty string if none). */
export const codeForNorm = (normId: string): string => NORM_CODE[normId] ?? "";
/** NORM_SET seeded with its codes — the starting point for the editable Norm Set module. */
export const NORM_SET_SEEDED: NormSetTask[] = NORM_SET.map((n) => ({ ...n, code: NORM_CODE[n.id] ?? "" }));
/** Distinct trades (first-seen order) for any norm-set list — editable lists included. */
export const normTrades = (set: NormSetTask[]): string[] =>
  set.reduce<string[]>((a, n) => (a.includes(n.trade) ? a : [...a, n.trade]), []);
/** Resolve a price-list code from a task description, via the Norm Set. */
export const codeForTask = (task: string): string => {
  const n = NORM_SET.find((x) => x.task.toLowerCase() === task.toLowerCase());
  return n ? NORM_CODE[n.id] ?? "" : "";
};

/* ------------------------------------------------------------------ */
/* 2. Estimate Templates — whole pre-made sheets                       */
/* ------------------------------------------------------------------ */

export type TemplateItem = Omit<EstimateItem, "id">;
export type TemplateCategory = { name: string; items: TemplateItem[] };
export type EstimateTemplate = {
  id: string; // dotted handle, e.g. "AEC.Traditional1LevelHouse"
  name: string;
  description: string;
  categories: TemplateCategory[];
};

// Compact line-item builder for templates (poc always starts at 0).
const t = (
  task: string,
  qty: number,
  unit: string,
  laborNorm: number,
  materialUnitCost = 0,
  equipmentUnitCost = 0,
  subcontractUnitCost = 0,
): TemplateItem => ({ task, qty, unit, laborNorm, materialUnitCost, equipmentUnitCost, subcontractUnitCost, poc: 0 });

const EARTHWORKS = (exc: number, bkf: number): TemplateCategory => ({
  name: "Earthworks",
  items: [t("Excavation for foundations", exc, "m³", 0.35, 0, 12), t("Backfilling & compaction", bkf, "m³", 0.25, 0, 6)],
});

const FOUNDATION = (foot: number, rebar: number, fw: number, wp: number): TemplateCategory => ({
  name: "Foundation",
  items: [
    t("Blinding / lean concrete", Math.round(foot * 0.3), "m³", 1.2, 380, 8),
    t("RC footings", foot, "m³", 3.5, 520, 15),
    t("Reinforcement steel (rebar)", rebar, "ton", 16, 2800),
    t("Formwork to footings", fw, "m²", 0.9, 75),
    t("Waterproofing to foundations", wp, "m²", 0.25, 45, 0, 35),
  ],
});

const MEP = (area: number, ac: number): TemplateCategory => ({
  name: "MEP Services",
  items: [
    t("Electrical first & second fix", area, "m²", 0, 0, 0, 120),
    t("Plumbing & drainage", area, "m²", 0, 0, 0, 95),
    t("HVAC (split units)", ac, "no", 0, 0, 0, 2200),
  ],
});

export const ESTIMATE_TEMPLATES: EstimateTemplate[] = [
  {
    id: "AEC.Traditional1LevelHouse",
    name: "AEC.Traditional1LevelHouse",
    description: "Single-storey villa — RC frame, block walls, plaster & paint.",
    categories: [
      EARTHWORKS(220, 120),
      FOUNDATION(60, 7, 180, 240),
      {
        name: "Superstructure (RC)",
        items: [
          t("RC columns", 18, "m³", 4.5, 540, 18),
          t("Formwork to columns", 120, "m²", 1.1, 85),
          t("RC beams", 26, "m³", 4.2, 535, 16),
          t("Formwork to beams", 150, "m²", 1.2, 88),
          t("RC slab on grade", 180, "m²", 0.5, 95, 4),
        ],
      },
      {
        name: "Masonry & Plaster",
        items: [
          t("200mm block walls", 420, "m²", 0.6, 55),
          t("Internal plaster", 820, "m²", 0.35, 18),
          t("External render", 360, "m²", 0.45, 22),
        ],
      },
      {
        name: "Finishes",
        items: [
          t("Floor tiling", 180, "m²", 0.5, 90),
          t("Painting (internal)", 820, "m²", 0.2, 12),
          t("Painting (external)", 360, "m²", 0.25, 16),
          t("Aluminium glazing (supply & install)", 45, "m²", 0, 0, 0, 650),
          t("Internal doors (supply & install)", 12, "no", 2.5, 850),
        ],
      },
      MEP(180, 6),
    ],
  },
  {
    id: "AEC.Traditional2LevelHouse",
    name: "AEC.Traditional2LevelHouse",
    description: "Two-storey villa — adds a suspended slab and larger quantities.",
    categories: [
      EARTHWORKS(260, 140),
      FOUNDATION(85, 10, 230, 300),
      {
        name: "Superstructure (RC)",
        items: [
          t("RC columns", 34, "m³", 4.5, 540, 18),
          t("Formwork to columns", 230, "m²", 1.1, 85),
          t("RC beams", 48, "m³", 4.2, 535, 16),
          t("Formwork to beams", 280, "m²", 1.2, 88),
        ],
      },
      {
        name: "Suspended Slab",
        items: [
          t("RC suspended slab", 90, "m³", 4.0, 530, 20),
          t("Formwork to slabs", 600, "m²", 0.8, 70),
          t("Reinforcement steel (rebar)", 9, "ton", 16, 2800),
        ],
      },
      {
        name: "Masonry & Plaster",
        items: [
          t("200mm block walls", 760, "m²", 0.6, 55),
          t("Internal plaster", 1480, "m²", 0.35, 18),
          t("External render", 640, "m²", 0.45, 22),
        ],
      },
      {
        name: "Finishes",
        items: [
          t("Floor tiling", 320, "m²", 0.5, 90),
          t("Painting (internal)", 1480, "m²", 0.2, 12),
          t("Painting (external)", 640, "m²", 0.25, 16),
          t("Aluminium glazing (supply & install)", 80, "m²", 0, 0, 0, 650),
          t("Internal doors (supply & install)", 20, "no", 2.5, 850),
        ],
      },
      MEP(330, 10),
    ],
  },
  {
    id: "AEC.ICF1LevelHouse",
    name: "AEC.ICF1LevelHouse",
    description: "Single-storey ICF — insulated concrete formwork walls in lieu of block.",
    categories: [
      EARTHWORKS(220, 120),
      FOUNDATION(60, 7, 180, 240),
      {
        name: "ICF Walls",
        items: [
          t("ICF wall system (supply & install)", 380, "m²", 0.8, 210),
          t("ICF concrete fill", 46, "m³", 1.0, 530, 18),
          t("Reinforcement steel (rebar)", 5, "ton", 16, 2800),
        ],
      },
      {
        name: "Roof & Slab",
        items: [
          t("RC slab on grade", 180, "m²", 0.5, 95, 4),
          t("Roof waterproofing membrane", 200, "m²", 0.3, 60, 0, 40),
        ],
      },
      {
        name: "Finishes",
        items: [
          t("Floor tiling", 180, "m²", 0.5, 90),
          t("Painting (internal)", 760, "m²", 0.2, 12),
          t("Gypsum board ceiling", 180, "m²", 0.4, 55),
          t("Aluminium glazing (supply & install)", 45, "m²", 0, 0, 0, 650),
          t("Internal doors (supply & install)", 12, "no", 2.5, 850),
        ],
      },
      MEP(180, 6),
    ],
  },
  {
    id: "AEC.ICF2LevelHouse",
    name: "AEC.ICF2LevelHouse",
    description: "Two-storey ICF — ICF walls both levels plus a suspended slab.",
    categories: [
      EARTHWORKS(260, 140),
      FOUNDATION(85, 10, 230, 300),
      {
        name: "ICF Walls",
        items: [
          t("ICF wall system (supply & install)", 720, "m²", 0.8, 210),
          t("ICF concrete fill", 88, "m³", 1.0, 530, 18),
          t("Reinforcement steel (rebar)", 9, "ton", 16, 2800),
        ],
      },
      {
        name: "Suspended Slab",
        items: [
          t("RC suspended slab", 90, "m³", 4.0, 530, 20),
          t("Formwork to slabs", 600, "m²", 0.8, 70),
          t("Reinforcement steel (rebar)", 9, "ton", 16, 2800),
        ],
      },
      {
        name: "Roof & Finishes",
        items: [
          t("Roof waterproofing membrane", 220, "m²", 0.3, 60, 0, 40),
          t("Floor tiling", 320, "m²", 0.5, 90),
          t("Painting (internal)", 1380, "m²", 0.2, 12),
          t("Gypsum board ceiling", 320, "m²", 0.4, 55),
          t("Aluminium glazing (supply & install)", 80, "m²", 0, 0, 0, 650),
          t("Internal doors (supply & install)", 20, "no", 2.5, 850),
        ],
      },
      MEP(330, 10),
    ],
  },
  {
    id: "AEC.BlankSheet",
    name: "AEC.BlankSheet",
    description: "Empty sheet — one section to start from scratch.",
    categories: [{ name: "New Section", items: [] }],
  },
];
