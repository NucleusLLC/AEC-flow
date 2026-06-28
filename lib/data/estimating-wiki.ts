/**
 * Estimating Wiki — knowledge base of norms, coverage rates and rules of thumb
 * used when building a cost estimate (paint coverage, ICF blocks per m², mortar
 * per m², rebar density, wastage allowances, labour productivity, etc.).
 *
 * Single-tenant -> SaaS hedge: read via the data layer; live version becomes a
 * firm-editable, searchable knowledge base. Static reference for now.
 */

export type WikiFact = { label: string; value: string };
export type WikiArticle = {
  id: string;
  title: string;
  category: string;
  tags: string[];
  summary: string;
  facts: WikiFact[];
  body?: string;
  illoKey?: string; // built-in SVG illustration key (see wiki-illustrations.tsx)
  image?: string; // uploaded illustration (data URL) — overrides illoKey when present
};

export const WIKI: WikiArticle[] = [
  {
    id: "w-paint",
    illoKey: "paint",
    title: "Paint coverage rates",
    category: "Finishes",
    tags: ["paint", "coverage", "emulsion", "litre", "smooth", "rough"],
    summary: "How far a litre of paint goes depends on surface texture and number of coats.",
    facts: [
      { label: "Smooth plaster (per coat)", value: "10–12 m² / litre" },
      { label: "Rough / textured render", value: "7–9 m² / litre" },
      { label: "Bare/porous masonry (1st coat)", value: "5–7 m² / litre" },
      { label: "Typical coats", value: "1 primer + 2 finish" },
    ],
    body: "Quote coverage per coat. For a 2-coat finish on smooth plaster use ~5–6 m²/L overall (two passes). Add a primer coat on new plaster. Rough surfaces and dark-over-light colour changes increase consumption.",
  },
  {
    id: "w-icf",
    illoKey: "icf",
    title: "ICF blocks per m² of wall",
    category: "ICF",
    tags: ["icf", "blocks", "wall", "insulated concrete form", "concrete fill"],
    summary: "ICF form coverage and the concrete volume needed to fill the cores.",
    facts: [
      { label: "Standard ICF form size", value: "1.22 m × 0.30 m ≈ 0.366 m²" },
      { label: "Forms per m² of wall", value: "≈ 2.7 forms / m²" },
      { label: "Concrete fill (200mm core)", value: "≈ 0.16 m³ / m² of wall" },
      { label: "Concrete fill (150mm core)", value: "≈ 0.12 m³ / m² of wall" },
      { label: "Waste allowance", value: "5–8% (cuts at openings)" },
    ],
    body: "Form counts vary by manufacturer (Nudura/Amvic block faces differ). Estimate concrete fill from core thickness × wall area, then add wastage. Rebar is placed in the cores per structural design.",
  },
  {
    id: "w-block",
    illoKey: "block",
    title: "Blockwork — blocks & mortar per m²",
    category: "Masonry",
    tags: ["block", "masonry", "mortar", "wall"],
    summary: "Standard 400×200 block counts and mortar consumption per m² of wall.",
    facts: [
      { label: "Blocks (400×200 face)", value: "12.5 blocks / m²" },
      { label: "Mortar (200mm wall)", value: "≈ 0.012 m³ / m²" },
      { label: "Mortar (bagged)", value: "≈ 0.5 bag / m²" },
      { label: "Waste allowance", value: "5%" },
    ],
  },
  {
    id: "w-plaster",
    illoKey: "plaster",
    title: "Plaster thickness & coverage",
    category: "Plaster & Screed",
    tags: ["plaster", "render", "thickness", "coverage", "screed"],
    summary: "Typical plaster build-up and material consumption.",
    facts: [
      { label: "Internal plaster", value: "12–15 mm (2 coats)" },
      { label: "External render", value: "20 mm (2–3 coats)" },
      { label: "Cement:sand mix", value: "1:4 to 1:6" },
      { label: "Mortar per m² (12mm)", value: "≈ 0.015 m³ / m²" },
    ],
  },
  {
    id: "w-rebar",
    illoKey: "rebar",
    title: "Rebar density (kg/m³ of concrete)",
    category: "Reinforcement",
    tags: ["rebar", "reinforcement", "steel", "density", "ratio"],
    summary: "Rule-of-thumb reinforcement ratios for quick steel tonnage estimates.",
    facts: [
      { label: "Footings / rafts", value: "80–110 kg/m³" },
      { label: "Columns", value: "150–250 kg/m³" },
      { label: "Beams", value: "120–200 kg/m³" },
      { label: "Suspended slabs", value: "90–130 kg/m³" },
      { label: "Slab on grade", value: "40–60 kg/m³" },
    ],
    body: "Multiply concrete volume by the ratio to get kg, then ÷1000 for tonnes. Always supersede with the bar bending schedule once available.",
  },
  {
    id: "w-tiling",
    illoKey: "tiling",
    title: "Tiling — adhesive & grout",
    category: "Finishes",
    tags: ["tile", "tiling", "adhesive", "grout", "coverage"],
    summary: "Adhesive consumption and wastage for floor/wall tiling.",
    facts: [
      { label: "Adhesive (notched 6mm)", value: "≈ 4 kg / m²" },
      { label: "Adhesive bag (20kg)", value: "≈ 4–5 m² / bag" },
      { label: "Tile waste", value: "8–10% (10% for large format)" },
      { label: "Grout", value: "≈ 0.3–0.5 kg / m²" },
    ],
  },
  {
    id: "w-concrete-waste",
    illoKey: "concrete",
    title: "Concrete wastage & bulking",
    category: "Concrete",
    tags: ["concrete", "wastage", "bulking", "excavation", "allowance"],
    summary: "Allowances to add to theoretical volumes.",
    facts: [
      { label: "Concrete wastage", value: "3–5% (5% for small pours)" },
      { label: "Excavation bulking", value: "+25–30% (loose vs in-situ)" },
      { label: "Compaction (fill)", value: "−10–15%" },
      { label: "Blinding under footings", value: "50–75 mm" },
    ],
  },
  {
    id: "w-labor",
    illoKey: "labor",
    title: "Labour productivity norms (how Norm Hrs/Unit work)",
    category: "Labour",
    tags: ["labour", "labor", "norm", "productivity", "hours", "rate"],
    summary: "Norm Hrs/Unit = crew-hours to complete one unit; × quantity = total hours; × rate = labour cost.",
    facts: [
      { label: "Formwork (walls/columns)", value: "1.0–1.3 hr/m²" },
      { label: "Rebar fix", value: "12–18 hr/ton" },
      { label: "Block laying", value: "0.5–0.7 hr/m²" },
      { label: "Plaster", value: "0.3–0.45 hr/m²" },
      { label: "Painting", value: "0.18–0.25 hr/m²" },
    ],
    body: "Norms bundle the crew's mix of trades into an average rate. Adjust for access, repetition, and site conditions. They feed directly into the estimate's 'Norm Set List'.",
  },
  {
    id: "w-markup",
    illoKey: "markup",
    title: "Mark-ups: Profit, BBO & overhead",
    category: "Commercial",
    tags: ["profit", "bbo", "overhead", "markup", "preliminaries"],
    summary: "Typical mark-ups applied on top of direct cost.",
    facts: [
      { label: "Profit", value: "10–25% (risk dependent)" },
      { label: "BBO / overhead", value: "5–10%" },
      { label: "Preliminaries", value: "8–15% of works" },
      { label: "Contingency", value: "3–10%" },
    ],
  },
  {
    id: "w-waterproof",
    illoKey: "waterproof",
    title: "Waterproofing systems",
    category: "Waterproofing",
    tags: ["waterproofing", "membrane", "coverage", "roof", "foundation"],
    summary: "Coverage and overlap allowances for common WP systems.",
    facts: [
      { label: "Bituminous membrane overlap", value: "100 mm side / 150 mm end" },
      { label: "Membrane waste", value: "10–12% (overlaps + upturns)" },
      { label: "Liquid WP (cementitious)", value: "≈ 1.5–2.0 kg/m² (2 coats)" },
      { label: "Protection screed", value: "40–50 mm" },
    ],
  },
  {
    id: "w-slab-types",
    illoKey: "slab-types",
    title: "Types of reinforced concrete slab",
    category: "Concrete",
    tags: ["slab", "rc", "self-weight", "kn/m2", "metal deck", "bubble deck", "emmedue", "psf100", "efficiency", "voided"],
    summary: "Self-weight (kN/m²) and material efficiency of common RC slab systems — for fast load take-down and slab selection.",
    facts: [
      { label: "1 · Typical RC slab (solid)", value: "4.5–6.0 kN/m²  ·  18 cm = 4.5 · 20 cm = 5.0  ·  not material-efficient" },
      { label: "2 · Metal-deck composite", value: "2.7–3.33 kN/m²  ·  corrugated · ≈40% efficient" },
      { label: "3 · EMMEDUE PSF100 panel", value: "2.12–2.71 kN/m²  ·  18.5 cm = 2.12 · 21 cm = 2.71 · ≈60% efficient" },
      { label: "4 · Bubble-deck (voided)", value: "3.9–4.5 kN/m²  ·  23 cm = 3.9–4.5 · 28 cm = 4.7–5.4 · ≈30% efficient" },
    ],
    body: "Indicative self-weights for preliminary load take-down and slab selection. Voided/composite systems (metal deck, EMMEDUE, bubble-deck) cut self-weight — and therefore the column, beam and foundation loads they impose — at the cost of detailing complexity. Confirm against the manufacturer's data and the structural design before use. Source: ZenArch structural reference — 'Type of Reinforced Concrete Slab'.",
  },
];

export const wikiCategories = (): string[] =>
  WIKI.reduce<string[]>((a, w) => (a.includes(w.category) ? a : [...a, w.category]), []);
