/**
 * What KIND of drawing is this? PURE — text in, a classified type out.
 *
 * WHY RULES BEFORE AI. The sheet almost always says what it is, in the title
 * block, in a language the practice already reads: "GROUND FLOOR PLAN",
 * "PLATTEGROND BEGANE GROND", "SECCIÓN A-A". A lexicon answers that in
 * microseconds, offline, for free, and — the part that matters — REPRODUCIBLY,
 * so the accuracy harness measures something stable. A model is the right tool
 * for the sheet that says "SHEET 04" and nothing else, which is why
 * `lib/server/sheet-type-ai.ts` exists and why it only runs when this module
 * comes back unsure.
 *
 * THREE LANGUAGES, DELIBERATELY. ZenArch works in Aruba: drawings arrive in
 * English from American consultants, in Dutch from the Netherlands and from
 * local authority submissions, and in Spanish from Venezuela and Colombia. A
 * classifier that only reads English would mark a third of the incoming set
 * "unknown", and the practice would stop trusting the column.
 *
 * SHEET NUMBERS ARE WEAK EVIDENCE, NOT STRONG. The US National CAD Standard
 * numbers plans 1xx, elevations 2xx, sections 3xx and details 5xx, and plenty
 * of offices follow it. Plenty do not, and an office that numbers sequentially
 * would be mislabelled with confidence. So the series contributes, it never
 * decides on its own, and it is always recorded as the evidence it is.
 */

import { field, type Alternate, type Evidence, type EvidenceSource, type Field } from "./types";

export type SheetType =
  | "COVER"
  | "GENERAL_NOTES"
  | "SITE_PLAN"
  | "DEMOLITION"
  | "FLOOR_PLAN"
  | "ROOF_PLAN"
  | "REFLECTED_CEILING_PLAN"
  | "FOUNDATION_PLAN"
  | "ELEVATION"
  | "SECTION"
  | "DETAIL"
  | "SCHEDULE"
  | "DIAGRAM"
  | "THREE_D"
  | "SURVEY"
  | "LANDSCAPE"
  | "OTHER";

export const SHEET_TYPES: SheetType[] = [
  "COVER",
  "GENERAL_NOTES",
  "SITE_PLAN",
  "DEMOLITION",
  "FLOOR_PLAN",
  "ROOF_PLAN",
  "REFLECTED_CEILING_PLAN",
  "FOUNDATION_PLAN",
  "ELEVATION",
  "SECTION",
  "DETAIL",
  "SCHEDULE",
  "DIAGRAM",
  "THREE_D",
  "SURVEY",
  "LANDSCAPE",
  "OTHER",
];

export const SHEET_TYPE_LABEL: Record<SheetType, string> = {
  COVER: "Cover sheet",
  GENERAL_NOTES: "General notes",
  SITE_PLAN: "Site plan",
  DEMOLITION: "Demolition",
  FLOOR_PLAN: "Floor plan",
  ROOF_PLAN: "Roof plan",
  REFLECTED_CEILING_PLAN: "Reflected ceiling plan",
  FOUNDATION_PLAN: "Foundation plan",
  ELEVATION: "Elevation",
  SECTION: "Section",
  DETAIL: "Detail",
  SCHEDULE: "Schedule",
  DIAGRAM: "Diagram",
  THREE_D: "3D view",
  SURVEY: "Survey",
  LANDSCAPE: "Landscape",
  OTHER: "Other",
};

type Rule = {
  type: SheetType;
  /** Matched against normalised text (upper case, accents folded, one space). */
  phrases: string[];
  /** 0..1 before any agreement bonus. A phrase that can only mean one thing scores high. */
  weight: number;
};

/**
 * Ordered most specific first. "REFLECTED CEILING" must beat "CEILING" and
 * "ROOF PLAN" must beat "PLAN", so the scan runs top-down and a longer phrase
 * on the same span wins.
 */
const RULES: Rule[] = [
  {
    type: "REFLECTED_CEILING_PLAN",
    phrases: ["REFLECTED CEILING", "RCP", "PLAFONDPLAN", "PLAFOND PLATTEGROND", "PLANO DE TECHO", "CIELO RASO"],
    weight: 0.95,
  },
  {
    type: "FOUNDATION_PLAN",
    phrases: ["FOUNDATION PLAN", "FOUNDATION LAYOUT", "FUNDERING", "FUNDERINGSPLAN", "PLANO DE FUNDACION", "CIMENTACION"],
    weight: 0.95,
  },
  {
    type: "ROOF_PLAN",
    phrases: ["ROOF PLAN", "ROOF LAYOUT", "DAKPLAN", "DAKAANZICHT", "PLANO DE CUBIERTA", "PLANTA DE TECHOS"],
    weight: 0.95,
  },
  {
    type: "DEMOLITION",
    phrases: ["DEMOLITION", "DEMOLITION PLAN", "TO BE DEMOLISHED", "SLOOPPLAN", "SLOOP", "DEMOLICION"],
    weight: 0.92,
  },
  {
    type: "SITE_PLAN",
    phrases: [
      "SITE PLAN",
      "SITE LAYOUT",
      "PLOT PLAN",
      "LOCATION PLAN",
      "BLOCK PLAN",
      "SITUATIE",
      "SITUATIETEKENING",
      "TERREININRICHTING",
      "PLANO DE SITUACION",
      "EMPLAZAMIENTO",
      "PLANTA DE CONJUNTO",
    ],
    weight: 0.93,
  },
  {
    type: "SURVEY",
    phrases: ["TOPOGRAPHIC", "SURVEY PLAN", "LAND SURVEY", "MEETBRIEF", "KADASTRAAL", "LEVANTAMIENTO", "TOPOGRAFICO"],
    weight: 0.9,
  },
  {
    type: "LANDSCAPE",
    phrases: ["LANDSCAPE PLAN", "PLANTING PLAN", "HARDSCAPE", "BEPLANTING", "TUINPLAN", "PAISAJISMO", "JARDINERIA"],
    weight: 0.9,
  },
  {
    type: "SECTION",
    phrases: [
      "SECTION",
      "SECTIONS",
      "CROSS SECTION",
      "LONGITUDINAL SECTION",
      "WALL SECTION",
      "DOORSNEDE",
      "DOORSNEDEN",
      "DWARSDOORSNEDE",
      "LANGSDOORSNEDE",
      "SECCION",
      "SECCIONES",
      "CORTE",
    ],
    weight: 0.92,
  },
  {
    type: "ELEVATION",
    phrases: [
      "ELEVATION",
      "ELEVATIONS",
      "EXTERIOR ELEVATION",
      "INTERIOR ELEVATION",
      "GEVEL",
      "GEVELS",
      "GEVELAANZICHT",
      "VOORGEVEL",
      "ACHTERGEVEL",
      "ZIJGEVEL",
      "AANZICHT",
      "FACHADA",
      "FACHADAS",
      "ALZADO",
    ],
    weight: 0.92,
  },
  {
    type: "DETAIL",
    phrases: ["DETAIL", "DETAILS", "TYPICAL DETAIL", "DETAILTEKENING", "DETAILS BLAD", "DETALLE", "DETALLES"],
    weight: 0.88,
  },
  {
    type: "SCHEDULE",
    phrases: [
      "SCHEDULE",
      "DOOR SCHEDULE",
      "WINDOW SCHEDULE",
      "FINISH SCHEDULE",
      "ROOM SCHEDULE",
      "STAAT VAN",
      "KOZIJNSTAAT",
      "DEURENSTAAT",
      "RAMENSTAAT",
      "CUADRO DE",
      "PLANILLA",
    ],
    weight: 0.9,
  },
  {
    type: "DIAGRAM",
    phrases: [
      "DIAGRAM",
      "RISER DIAGRAM",
      "SINGLE LINE",
      "ONE LINE",
      "SCHEMATIC",
      "FLOW DIAGRAM",
      "SCHEMA",
      "PRINCIPESCHEMA",
      "ESQUEMA",
      "DIAGRAMA",
    ],
    weight: 0.88,
  },
  {
    type: "THREE_D",
    phrases: ["3D VIEW", "PERSPECTIVE", "AXONOMETRIC", "ISOMETRIC", "RENDER", "RENDERING", "IMPRESSIE", "PERSPECTIVA"],
    weight: 0.85,
  },
  {
    type: "COVER",
    phrases: ["COVER SHEET", "TITLE SHEET", "DRAWING LIST", "SHEET INDEX", "SHEET LIST", "TITELBLAD", "TEKENINGENLIJST", "PORTADA", "INDICE DE PLANOS"],
    weight: 0.9,
  },
  {
    type: "GENERAL_NOTES",
    phrases: ["GENERAL NOTES", "LEGEND", "ABBREVIATIONS", "SYMBOLS", "ALGEMENE NOTITIES", "LEGENDA", "NOTAS GENERALES", "SIMBOLOGIA"],
    weight: 0.85,
  },
  {
    // Last of the plan family on purpose: everything above is also "a plan",
    // and a bare "PLAN" should only win when nothing more specific matched.
    type: "FLOOR_PLAN",
    phrases: [
      "FLOOR PLAN",
      "FLOORPLAN",
      "GROUND FLOOR",
      "FIRST FLOOR",
      "SECOND FLOOR",
      "UPPER FLOOR",
      "MEZZANINE PLAN",
      "LAYOUT PLAN",
      "FURNITURE PLAN",
      "DIMENSION PLAN",
      "PLATTEGROND",
      "BEGANE GROND",
      "VERDIEPING",
      "INDELINGSPLAN",
      "PLANTA BAJA",
      "PLANTA ALTA",
      "PLANTA ARQUITECTONICA",
      "PLANO DE PLANTA",
      "DISTRIBUCION",
    ],
    weight: 0.93,
  },
];

/**
 * US National CAD Standard sheet-number series. WEAK evidence — it never wins
 * on its own, it breaks a tie and it adds confidence when it agrees with a
 * phrase.
 */
const SERIES_HINT: Record<string, SheetType> = {
  "0": "GENERAL_NOTES",
  "1": "FLOOR_PLAN",
  "2": "ELEVATION",
  "3": "SECTION",
  "4": "DETAIL", // large-scale views
  "5": "DETAIL",
  "6": "SCHEDULE",
  "7": "DIAGRAM",
  "8": "DIAGRAM",
  "9": "THREE_D",
};

const SERIES_WEIGHT = 0.35;

/** Upper case, accents folded, punctuation to spaces, runs collapsed. */
export function normaliseForMatch(text: string): string {
  return (text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

export type SheetTypeInput = {
  /** The sheet title, when one was read. The strongest single signal. */
  title?: string | null;
  /** The whole title-block text. Noisier, still useful. */
  titleBlockText?: string | null;
  /** The filename, for the case where nothing else was read. */
  filename?: string | null;
  /** e.g. `A-101`. Only its series digit is used. */
  sheetNumber?: string | null;
};

type Hit = { type: SheetType; score: number; evidence: Evidence };

function scan(text: string, source: EvidenceSource, weightScale: number): Hit[] {
  const haystack = normaliseForMatch(text);
  if (!haystack) return [];
  const hits: Hit[] = [];
  const claimed: { start: number; end: number }[] = [];

  for (const rule of RULES) {
    for (const phrase of rule.phrases) {
      const index = haystack.indexOf(phrase);
      if (index < 0) continue;
      const end = index + phrase.length;
      // A longer, more specific phrase earlier in RULES owns this span; do not
      // also credit "PLAN" inside "ROOF PLAN".
      if (claimed.some((c) => index < c.end && end > c.start)) continue;
      claimed.push({ start: index, end });
      hits.push({
        type: rule.type,
        score: rule.weight * weightScale,
        evidence: {
          source,
          pattern: `sheet-type.${rule.type.toLowerCase()}`,
          fragment: phrase,
          index,
        },
      });
      break; // one hit per rule per source
    }
  }
  return hits;
}

function seriesHit(sheetNumber: string | null | undefined): Hit | null {
  const m = /^[A-Z]{1,3}[-. ]?(\d)\d{2}\b/.exec(normaliseForMatch(sheetNumber ?? ""));
  if (!m) return null;
  const type = SERIES_HINT[m[1]];
  if (!type) return null;
  return {
    type,
    score: SERIES_WEIGHT,
    evidence: {
      source: "titleblock-scan",
      pattern: `sheet-type.series-${m[1]}xx`,
      fragment: m[0],
      note: "Sheet-number series (US National CAD Standard). A convention, not a rule.",
    },
  };
}

/**
 * Classify a sheet. Returns null when nothing in the inputs suggests a type —
 * "we do not know" is a first-class answer here, and it is the signal
 * `lib/server/sheet-type-ai.ts` uses to decide whether to ask a model.
 */
export function classifySheetType(input: SheetTypeInput): Field<SheetType> | null {
  const hits: Hit[] = [
    // The title is what the draughtsman called the sheet: trust it most.
    ...scan(input.title ?? "", "titleblock-label", 1),
    ...scan(input.titleBlockText ?? "", "titleblock-scan", 0.85),
    ...scan(input.filename ?? "", "filename", 0.7),
  ];

  const series = seriesHit(input.sheetNumber);
  if (series) hits.push(series);

  if (hits.length === 0) return null;

  const byType = new Map<SheetType, { score: number; evidence: Evidence[] }>();
  for (const hit of hits) {
    const entry = byType.get(hit.type) ?? { score: 0, evidence: [] };
    // Two sources agreeing is worth more than either alone, but the second
    // source is corroboration, not a second vote: it adds a fraction.
    entry.score = entry.score === 0 ? hit.score : entry.score + hit.score * 0.35;
    entry.evidence.push(hit.evidence);
    byType.set(hit.type, entry);
  }

  const ranked = [...byType.entries()]
    .map(([type, e]) => ({ type, score: Math.min(0.99, e.score), evidence: e.evidence }))
    .sort((a, b) => b.score - a.score);

  const [best, ...rest] = ranked;

  // A series hint on its own is a guess, and it must not be dressed up as a
  // reading. It is reported at a confidence that lands in the "low" band.
  const onlySeries = best.evidence.length === 1 && best.evidence[0].pattern.startsWith("sheet-type.series-");
  const confidence = onlySeries ? 0.3 : best.score;

  const alternates: Alternate<SheetType>[] = rest
    .slice(0, 3)
    .map((r) => ({ value: r.type, confidence: r.score, evidence: r.evidence }));

  return field(best.type, confidence, best.evidence, alternates);
}

/** Whether the rules are sure enough that asking a model would be waste. */
export function isConfidentClassification(f: Field<SheetType> | null): boolean {
  return Boolean(f && f.confidence >= 0.8);
}
