/**
 * Materials & Equipment Price Lists — client-safe declarations + seed data.
 *
 * Split out of `lib/data/price-lists.ts` so client components import the type,
 * constants and helpers WITHOUT pulling in Prisma (see [[aec-prisma-client-boundary]]).
 * The static arrays below are the seed source (loaded into the `price_items`
 * table by prisma/seed.ts) and a fallback for offline rendering.
 */

export type PriceItem = {
  id: string;
  code: string; // short reference code
  name: string;
  category: string; // grouping
  unit: string;
  unitPrice: number;
  supplier?: string;
  note?: string;
  region?: string; // "Aruba" | "UAE" (undefined → UAE)
  currency?: string; // overrides PRICE_CURRENCY per item
};

export const PRICE_CURRENCY = "AED"; // legacy/UAE fallback
export const PRICE_REGIONS = ["Aruba", "UAE"] as const;
export const DEFAULT_REGION = "Aruba";
export const REGION_CURRENCY: Record<string, string> = { Aruba: "USD", UAE: "AED" };
export const regionOf = (p: PriceItem): string => p.region ?? "UAE";
export const currencyOf = (p: PriceItem): string => p.currency ?? REGION_CURRENCY[regionOf(p)] ?? PRICE_CURRENCY;

/* Materials -------------------------------------------------------- */
export const MATERIAL_PRICES: PriceItem[] = [
  // Concrete & cement
  { id: "m-c30", code: "CON-C30", name: "Ready-mix concrete C30/20", category: "Concrete & Cement", unit: "m³", unitPrice: 295, supplier: "Unibeton" },
  { id: "m-c40", code: "CON-C40", name: "Ready-mix concrete C40/20", category: "Concrete & Cement", unit: "m³", unitPrice: 330, supplier: "Unibeton" },
  { id: "m-lean", code: "CON-LEAN", name: "Lean / blinding concrete C15", category: "Concrete & Cement", unit: "m³", unitPrice: 240, supplier: "Unibeton" },
  { id: "m-opc", code: "CEM-OPC", name: "OPC cement (50kg bag)", category: "Concrete & Cement", unit: "bag", unitPrice: 14 },
  { id: "m-sand", code: "AGG-SAND", name: "Washed sand", category: "Concrete & Cement", unit: "m³", unitPrice: 55 },
  { id: "m-agg", code: "AGG-20", name: "Aggregate 20mm", category: "Concrete & Cement", unit: "m³", unitPrice: 70 },

  // Reinforcement
  { id: "m-rebar", code: "RFT-B500", name: "Reinforcement bar B500B", category: "Reinforcement", unit: "ton", unitPrice: 2650, supplier: "Emirates Steel" },
  { id: "m-mesh", code: "RFT-MESH", name: "Welded mesh A142", category: "Reinforcement", unit: "m²", unitPrice: 19 },
  { id: "m-tiewire", code: "RFT-TIE", name: "Tying wire (galv.)", category: "Reinforcement", unit: "kg", unitPrice: 6 },

  // Masonry
  { id: "m-blk200", code: "BLK-200", name: "Hollow block 200mm", category: "Masonry", unit: "no", unitPrice: 3.2 },
  { id: "m-blk100", code: "BLK-100", name: "Hollow block 100mm", category: "Masonry", unit: "no", unitPrice: 2.3 },
  { id: "m-mortar", code: "MAS-MORT", name: "Masonry mortar (bagged)", category: "Masonry", unit: "bag", unitPrice: 12 },

  // Formwork
  { id: "m-frm", code: "FRM-PLY", name: "Formwork plywood, timber & ties", category: "Formwork", unit: "m²", unitPrice: 85, note: "per use, incl. props" },

  // ICF
  { id: "m-icf", code: "ICF-FORM", name: "ICF form block (EPS)", category: "ICF", unit: "m²", unitPrice: 165, supplier: "Nudura", note: "wall face area" },
  { id: "m-icf-clip", code: "ICF-CLIP", name: "ICF bracing / clip set", category: "ICF", unit: "set", unitPrice: 45 },

  // Waterproofing & insulation
  { id: "m-wp-mem", code: "WP-MEMB", name: "Bituminous membrane (4mm)", category: "Waterproofing", unit: "m²", unitPrice: 26 },
  { id: "m-wp-liq", code: "WP-LIQ", name: "Liquid applied WP (cementitious)", category: "Waterproofing", unit: "m²", unitPrice: 18 },
  { id: "m-insu", code: "INS-XPS", name: "XPS insulation board 50mm", category: "Waterproofing", unit: "m²", unitPrice: 34 },

  // Plaster & screed
  { id: "m-plast", code: "PLS-CEM", name: "Cement plaster mix", category: "Plaster & Screed", unit: "m²", unitPrice: 9, note: "12mm, 2 coats" },
  { id: "m-screed", code: "SCR-50", name: "Floor screed 50mm", category: "Plaster & Screed", unit: "m²", unitPrice: 22 },

  // Paint & finishes
  { id: "m-paint-in", code: "PNT-EMUL", name: "Emulsion paint (interior)", category: "Paint & Finishes", unit: "litre", unitPrice: 16, note: "~10–12 m²/L smooth" },
  { id: "m-paint-ex", code: "PNT-EXT", name: "Weathershield paint (exterior)", category: "Paint & Finishes", unit: "litre", unitPrice: 28, note: "~7–9 m²/L render" },
  { id: "m-primer", code: "PNT-PRIM", name: "Primer / sealer", category: "Paint & Finishes", unit: "litre", unitPrice: 14 },
  { id: "m-tile-fl", code: "TIL-POR", name: "Porcelain floor tile 600×600", category: "Paint & Finishes", unit: "m²", unitPrice: 65 },
  { id: "m-tile-wl", code: "TIL-CER", name: "Ceramic wall tile", category: "Paint & Finishes", unit: "m²", unitPrice: 48 },
  { id: "m-tile-adh", code: "TIL-ADH", name: "Tile adhesive (20kg)", category: "Paint & Finishes", unit: "bag", unitPrice: 28, note: "~4–5 m²/bag" },
  { id: "m-gypsum", code: "GYP-CEIL", name: "Gypsum board 12.5mm", category: "Paint & Finishes", unit: "m²", unitPrice: 30 },

  // Joinery & glazing
  { id: "m-door", code: "DR-INT", name: "Internal door (HDF, hung set)", category: "Joinery & Glazing", unit: "no", unitPrice: 780 },
  { id: "m-glaz", code: "GLZ-ALU", name: "Aluminium glazing (double)", category: "Joinery & Glazing", unit: "m²", unitPrice: 620, supplier: "Alico" },
];

/* Equipment (rental) ---------------------------------------------- */
export const EQUIPMENT_PRICES: PriceItem[] = [
  { id: "e-exc", code: "EQ-EXC", name: "Excavator 20-ton (w/ operator)", category: "Earthmoving", unit: "day", unitPrice: 1450 },
  { id: "e-load", code: "EQ-LOAD", name: "Wheel loader (w/ operator)", category: "Earthmoving", unit: "day", unitPrice: 1100 },
  { id: "e-roller", code: "EQ-ROLL", name: "Vibratory roller", category: "Earthmoving", unit: "day", unitPrice: 850 },
  { id: "e-pump", code: "EQ-PUMP", name: "Concrete pump (boom)", category: "Concrete", unit: "day", unitPrice: 2200 },
  { id: "e-vib", code: "EQ-VIB", name: "Poker vibrator", category: "Concrete", unit: "day", unitPrice: 120 },
  { id: "e-mixer", code: "EQ-MIX", name: "Site mixer (drum)", category: "Concrete", unit: "day", unitPrice: 180 },
  { id: "e-crane", code: "EQ-CRN", name: "Mobile crane 50-ton (w/ operator)", category: "Lifting", unit: "day", unitPrice: 2800 },
  { id: "e-hoist", code: "EQ-HST", name: "Material hoist", category: "Lifting", unit: "month", unitPrice: 4200 },
  { id: "e-scaff", code: "EQ-SCF", name: "Scaffolding (supply & erect)", category: "Access", unit: "m²", unitPrice: 38 },
  { id: "e-boom", code: "EQ-BOOM", name: "Boom lift 20m", category: "Access", unit: "day", unitPrice: 950 },
  { id: "e-gen", code: "EQ-GEN", name: "Diesel generator 100kVA", category: "Power & Misc", unit: "day", unitPrice: 420 },
  { id: "e-tools", code: "EQ-PWR", name: "Power tools allowance", category: "Power & Misc", unit: "day", unitPrice: 90 },
];

/* Aruba supplier prices — APEX (ready-mix & blocks) · Kooyman (building materials).
 * Seed values in USD; refreshed at runtime by the /api/prices "live fetch" (see route). */
export const ARUBA_PRICES: PriceItem[] = [
  { id: "ar-apx-rmx", code: "APX-RMX", name: "Ready-mix concrete (3000 psi)", category: "Concrete & Cement", unit: "m³", unitPrice: 138, supplier: "APEX", region: "Aruba", currency: "USD" },
  { id: "ar-apx-blk4", code: "APX-BLK4", name: 'Concrete block 4"', category: "Masonry", unit: "no", unitPrice: 1.15, supplier: "APEX", region: "Aruba", currency: "USD" },
  { id: "ar-apx-blk6", code: "APX-BLK6", name: 'Concrete block 6"', category: "Masonry", unit: "no", unitPrice: 1.45, supplier: "APEX", region: "Aruba", currency: "USD" },
  { id: "ar-apx-blk8", code: "APX-BLK8", name: 'Concrete block 8"', category: "Masonry", unit: "no", unitPrice: 1.85, supplier: "APEX", region: "Aruba", currency: "USD" },
  { id: "ar-koy-cem", code: "KOY-CEM", name: "Portland cement (42.5kg bag)", category: "Concrete & Cement", unit: "bag", unitPrice: 8.5, supplier: "Kooyman", region: "Aruba", currency: "USD" },
  { id: "ar-koy-2x4", code: "KOY-2X4", name: "Lumber 2×4 (per ft)", category: "Wood & Lumber", unit: "ft", unitPrice: 0.85, supplier: "Kooyman", region: "Aruba", currency: "USD" },
  { id: "ar-koy-lmb", code: "KOY-LMB", name: "Hardwood lumber (per board-ft)", category: "Wood & Lumber", unit: "bf", unitPrice: 3.2, supplier: "Kooyman", region: "Aruba", currency: "USD" },
  { id: "ar-koy-ply", code: "KOY-PLY", name: "Plywood 18mm 4×8 sheet", category: "Wood & Lumber", unit: "sheet", unitPrice: 52, supplier: "Kooyman", region: "Aruba", currency: "USD" },
  { id: "ar-koy-scr", code: "KOY-SCR", name: "Wood screws (box of 100)", category: "Fixings", unit: "box", unitPrice: 9.5, supplier: "Kooyman", region: "Aruba", currency: "USD" },
  { id: "ar-koy-pnt", code: "KOY-PNT", name: "Latex paint (gallon)", category: "Paint & Finishes", unit: "gal", unitPrice: 28, supplier: "Kooyman", region: "Aruba", currency: "USD", note: "~350 sq.ft/gal" },
  { id: "ar-koy-stu", code: "KOY-STU", name: "Stucco / render mix (bag)", category: "Plaster & Render", unit: "bag", unitPrice: 11, supplier: "Kooyman", region: "Aruba", currency: "USD" },
  { id: "ar-koy-pvc", code: "KOY-PVC", name: "PVC pipe & fittings (set)", category: "Plumbing", unit: "set", unitPrice: 24, supplier: "Kooyman", region: "Aruba", currency: "USD" },
  { id: "ar-koy-pex", code: "KOY-PEX", name: "PEX plumbing kit", category: "Plumbing", unit: "set", unitPrice: 46, supplier: "Kooyman", region: "Aruba", currency: "USD" },
];

/** Materials across all regions (UAE base + Aruba suppliers). */
export const ALL_MATERIALS: PriceItem[] = [...MATERIAL_PRICES, ...ARUBA_PRICES];

export const materialCategories = (): string[] =>
  ALL_MATERIALS.reduce<string[]>((a, p) => (a.includes(p.category) ? a : [...a, p.category]), []);
export const equipmentCategories = (): string[] =>
  EQUIPMENT_PRICES.reduce<string[]>((a, p) => (a.includes(p.category) ? a : [...a, p.category]), []);
