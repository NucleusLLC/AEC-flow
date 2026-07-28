/**
 * Document design tokens — the single source of truth for page geometry,
 * typography, spacing and table rhythm across every printed document.
 *
 * WHY THIS EXISTS. Page geometry used to be declared inline, per route, as a
 * `<style>{`@page { … }`}</style>` literal. Fourteen such declarations existed
 * with margins ranging from 0mm to 14mm and A4 hardcoded almost everywhere, so
 * "make the documents consistent" was not a thing anyone could do in one place.
 * See docs/document-system/01-AUDIT.md §F2.
 *
 * UNITS. Print units only — millimetres for geometry, points for type. CSS
 * pixels are deliberately absent: they are not a dependable print unit, and
 * mixing them is how preview and export drift apart (directive §15).
 *
 * These tokens are renderer-agnostic. They describe the document, not the
 * mechanism that paints it, so they hold whether pages are produced by the
 * browser's print dialog or by a headless renderer.
 */

/* ────────────────────────────── page geometry ───────────────────────────── */

export type PaperSize = "A4" | "Letter" | "Legal" | "A3";
export type Orientation = "portrait" | "landscape";

/** Trim size in millimetres, portrait. Landscape swaps the pair. */
export const PAPER_MM: Record<PaperSize, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  Letter: { width: 215.9, height: 279.4 },
  Legal: { width: 215.9, height: 355.6 },
  A3: { width: 297, height: 420 },
};

export type Margins = { top: number; right: number; bottom: number; left: number };

/**
 * Margin presets, in millimetres, within the directive's §15 guidance
 * (top/bottom 14–18, left/right 16–20). `compact` sits at the tight end for
 * dense registers; `standard` is the default for correspondence and proposals.
 */
export const MARGIN_PRESETS = {
  compact: { top: 12, right: 12, bottom: 12, left: 12 },
  standard: { top: 15, right: 16, bottom: 15, left: 16 },
  comfortable: { top: 18, right: 20, bottom: 18, left: 20 },
} as const satisfies Record<string, Margins>;

export type MarginPreset = keyof typeof MARGIN_PRESETS;

export type PageGeometry = {
  paper: PaperSize;
  orientation: Orientation;
  margins: Margins;
};

export const DEFAULT_PAGE: PageGeometry = {
  paper: "A4",
  orientation: "portrait",
  margins: MARGIN_PRESETS.standard,
};

/** Trim size after orientation is applied. */
export function pageSizeMm(page: Pick<PageGeometry, "paper" | "orientation">): {
  width: number;
  height: number;
} {
  const { width, height } = PAPER_MM[page.paper];
  return page.orientation === "landscape"
    ? { width: height, height: width }
    : { width, height };
}

/**
 * Printable area after margins — what the layout engine may actually fill.
 * Header and footer heights are subtracted separately by the caller, because
 * those vary per header mode (directive §15, §16).
 */
export function printableAreaMm(page: PageGeometry): { width: number; height: number } {
  const { width, height } = pageSizeMm(page);
  return {
    width: width - page.margins.left - page.margins.right,
    height: height - page.margins.top - page.margins.bottom,
  };
}

/* ──────────────────────────────── typography ────────────────────────────── */

/**
 * Type sizes in points. The ranges come from directive §13; these are the
 * defaults within those ranges, and `TYPE_LIMITS` enforces the bounds so a
 * settings screen cannot drive text below readability.
 */
export const TYPE_SCALE = {
  documentTitle: 19,
  subtitle: 11.5,
  majorHeading: 13,
  subheading: 11,
  body: 9.5,
  compactBody: 9,
  tableBody: 8.5,
  metadata: 8,
  footer: 7.5,
  legal: 7.5,
} as const;

export type TypeRole = keyof typeof TYPE_SCALE;

/** Hard readability bounds. Values outside these must raise a warning, never render. */
export const TYPE_LIMITS: Record<TypeRole, { min: number; max: number }> = {
  documentTitle: { min: 16, max: 26 },
  subtitle: { min: 10, max: 13 },
  majorHeading: { min: 12, max: 15 },
  subheading: { min: 10, max: 12 },
  body: { min: 9, max: 10.5 },
  compactBody: { min: 8.5, max: 9.5 },
  tableBody: { min: 7.8, max: 9 },
  metadata: { min: 7.5, max: 8.5 },
  footer: { min: 7, max: 8.5 },
  legal: { min: 7, max: 8.5 },
};

/** Clamps a size into its readable range. Returns what was applied and whether it moved. */
export function clampTypeSize(role: TypeRole, pt: number): { pt: number; clamped: boolean } {
  const { min, max } = TYPE_LIMITS[role];
  const next = Math.min(max, Math.max(min, pt));
  return { pt: next, clamped: next !== pt };
}

/** Unitless line heights. Denser roles get tighter leading, never below 1.15. */
export const LINE_HEIGHT: Record<TypeRole, number> = {
  documentTitle: 1.15,
  subtitle: 1.3,
  majorHeading: 1.2,
  subheading: 1.25,
  body: 1.45,
  compactBody: 1.35,
  tableBody: 1.3,
  metadata: 1.3,
  footer: 1.2,
  legal: 1.3,
};

export const FONT_WEIGHT = {
  documentTitle: 700,
  majorHeading: 600,
  subheading: 600,
  label: 600,
  body: 400,
  total: 700,
  note: 400,
} as const;

/* ───────────────────────────── spacing & density ────────────────────────── */

export type Density = "comfortable" | "standard" | "compact";

/**
 * Vertical rhythm in millimetres, per density (directive §14). Density changes
 * spacing only — never business data, calculations, required clauses, numbering
 * or logo availability.
 */
export const SPACING: Record<Density, {
  paragraph: number;
  section: number;
  headingBefore: number;
  headingAfter: number;
  listItem: number;
  tableCellY: number;
  tableCellX: number;
  captionGap: number;
  photoGap: number;
}> = {
  comfortable: {
    paragraph: 3.2, section: 7.5, headingBefore: 6.5, headingAfter: 2.6,
    listItem: 1.6, tableCellY: 2.0, tableCellX: 2.6, captionGap: 1.4, photoGap: 3.2,
  },
  standard: {
    paragraph: 2.4, section: 5.5, headingBefore: 5.0, headingAfter: 2.0,
    listItem: 1.1, tableCellY: 1.5, tableCellX: 2.2, captionGap: 1.1, photoGap: 2.4,
  },
  compact: {
    paragraph: 1.6, section: 3.6, headingBefore: 3.2, headingAfter: 1.4,
    listItem: 0.7, tableCellY: 1.0, tableCellX: 1.8, captionGap: 0.8, photoGap: 1.6,
  },
};

/** Default density per document type (directive §14 table). */
export const DEFAULT_DENSITY: Record<string, Density> = {
  proposal: "standard",
  serviceProposal: "standard",
  letter: "standard",
  memo: "standard",
  changeOrder: "standard",
  punchList: "compact",
  register: "compact",
  meetingMinutes: "compact",
  fieldReport: "standard",
  invoice: "compact",
  estimate: "standard",
  schedule: "compact",
};

/* ─────────────────────────────── system logo ────────────────────────────── */

/**
 * System Logo placeholder dimensions (directive §3). The slot keeps its width
 * whether or not an image is configured, so headers do not reflow when a company
 * uploads a logo — and so the placeholder can never be "optimised away" to
 * reclaim vertical space (§3.2).
 */
export const LOGO_TOKENS = {
  maxWidthMm: 55,
  maxHeightMm: 16,
  minWidthMm: 28,
  continuationMaxHeightMm: 10,
  defaultAlignment: "left" as const,
};

/* ──────────────────────────── header & footer ───────────────────────────── */

export type HeaderMode =
  | "none" | "minimal" | "corporate" | "project" | "formalReport" | "letterhead" | "continuation";

export type FooterMode = "none" | "minimal" | "corporate" | "project" | "confidential" | "legal";

/**
 * Nominal header/footer heights in millimetres. The pagination engine needs a
 * predictable figure to compute usable area (§16: "header height must be fixed
 * or predictably measurable").
 */
export const HEADER_HEIGHT_MM: Record<HeaderMode, number> = {
  none: 0, minimal: 10, corporate: 20, project: 22, formalReport: 22, letterhead: 24, continuation: 12,
};

export const FOOTER_HEIGHT_MM: Record<FooterMode, number> = {
  none: 0, minimal: 7, corporate: 10, project: 10, confidential: 10, legal: 12,
};

/** Usable content height once margins, header and footer are removed. */
export function contentHeightMm(
  page: PageGeometry,
  header: HeaderMode,
  footer: FooterMode,
): number {
  return printableAreaMm(page).height - HEADER_HEIGHT_MM[header] - FOOTER_HEIGHT_MM[footer];
}

/* ──────────────────────────────── tables ────────────────────────────────── */

export const TABLE_TOKENS = {
  /** A repeated header must be followed by at least this many body rows (§7.2). */
  minRowsAfterHeader: 2,
  zebraOpacity: 0.04,
  headerRuleWidthPt: 1,
  bodyRuleWidthPt: 0.5,
  totalsRuleWidthPt: 1.5,
  /** Columns narrower than this cannot hold readable wrapped text. */
  minColumnMm: 14,
};

/* ─────────────────────────── pagination controls ────────────────────────── */

/** Break-control vocabulary the renderers translate into CSS or engine rules (§24). */
export const BREAK_RULES = {
  minimumFollowingLines: 2,
  minimumOrphanLines: 2,
  minimumWidowLines: 2,
} as const;

/** Fraction of a non-final page that may sit unused before it is flagged (§7.1). */
export const UNUSED_AREA_WARN = 0.3;
export const UNUSED_AREA_TARGET_COMPACT = 0.2;
