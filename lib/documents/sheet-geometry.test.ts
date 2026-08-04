/**
 * The sheet a document is laid out on, and the proof that the on-screen copy of
 * it agrees with `@page`.
 *
 * WHY THIS EXISTS. Every print route used to restate the page geometry as its own
 * literals — `w-[210mm]` here, `p-[14mm]` there, `pageContentHeightMm={269}` in a
 * third place — beside a `<PageRules margins={…} />` holding a different set of
 * numbers. Nothing connected them, so nothing could notice when they disagreed,
 * and they had: the landscape punch-list register declared 12mm page margins and
 * padded its sheet by 14, which means its preview wrapped every row at a width the
 * printer would never use. A preview laid out at the wrong width is not a preview,
 * and no test in this repository could see it, because the numbers lived in JSX
 * that only a browser runs.
 *
 * These assertions state the relationship instead of the numbers: whatever margins
 * a document asks for, the screen sheet, the text block, the paginator's page
 * height and the footer band must all be derived from those same margins. A future
 * edit that moves one and not the others fails here rather than on paper.
 */
import { describe, it, expect } from "vitest";
import { pageRulesCss, DOCUMENT_SHEET_CLASS } from "@/components/print/page-rules";
import {
  sheetGeometry,
  gutterZones,
  FOOTER_FROM_EDGE_MM,
  SHEET_GAP_MM,
} from "@/lib/documents/preview-geometry";
import { MARGIN_PRESETS, PAPER_MM, type Margins, type PaperSize } from "@/lib/documents/tokens";

/** Every page a document in this app is actually printed on. */
const SURFACES = [
  { paper: "A4", orientation: "portrait" },
  { paper: "A4", orientation: "landscape" },
] as const;

/** The `.aec-doc-sheet` declarations PageRules emits, as a single string. */
function screenSheetRule(css: string): string {
  const m = css.match(new RegExp(`@media screen \\{ \\.${DOCUMENT_SHEET_CLASS} \\{([^}]*)\\}`));
  expect(m, "no screen sheet rule was emitted").not.toBeNull();
  return m![1];
}

function declaration(rule: string, prop: string): string | null {
  const m = rule.match(new RegExp(`(?:^|;)\\s*${prop}:\\s*([^;]+)`));
  return m ? m[1].trim() : null;
}

/**
 * Every block opening with `prefix`, closed by brace counting rather than by a
 * regex — the print rules nest `.aec-doc { … }` inside `@media print { … }`, and
 * a lazy `[\s\S]*?\}` stops at the first inner brace while a greedy one swallows
 * the rest of the stylesheet.
 */
function balancedBlocks(css: string, prefix: string): string[] {
  const out: string[] = [];
  let from = 0;
  for (;;) {
    const start = css.indexOf(prefix, from);
    if (start < 0) return out;
    let depth = 0;
    for (let i = start; i < css.length; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}" && --depth === 0) {
        out.push(css.slice(start, i + 1));
        from = i + 1;
        break;
      }
      if (i === css.length - 1) return out;
    }
  }
}

describe("sheetGeometry", () => {
  it("defaults to the document preset on A4 portrait", () => {
    const g = sheetGeometry();
    expect(g.margins).toEqual(MARGIN_PRESETS.document);
    expect(g.sheetWidthMm).toBe(210);
    expect(g.sheetHeightMm).toBe(297);
    // The 182 x 263 text block the Construction Admin shell used to hard-code.
    expect(g.contentWidthMm).toBeCloseTo(182, 6);
    expect(g.contentHeightMm).toBeCloseTo(263, 6);
  });

  it("swaps the axes for the landscape register rather than widening the margins", () => {
    const g = sheetGeometry({ orientation: "landscape" });
    expect(g.sheetWidthMm).toBe(297);
    expect(g.sheetHeightMm).toBe(210);
    expect(g.contentWidthMm).toBeCloseTo(297 - 14 - 14, 6);
    expect(g.contentHeightMm).toBeCloseTo(210 - 14 - 20, 6);
    // The margins are the SAME as portrait: orientation is a content decision,
    // not licence to print a different document.
    expect(g.margins).toEqual(MARGIN_PRESETS.document);
  });

  it("resolves a named preset and an explicit box to the same thing", () => {
    const byName = sheetGeometry({ margins: "compact" });
    const byBox = sheetGeometry({ margins: MARGIN_PRESETS.compact as Margins });
    expect(byName).toEqual(byBox);
  });

  it("derives the text block from the margins for every paper size", () => {
    for (const paper of Object.keys(PAPER_MM) as PaperSize[]) {
      for (const [name, m] of Object.entries(MARGIN_PRESETS)) {
        const g = sheetGeometry({ paper, margins: name as keyof typeof MARGIN_PRESETS });
        expect(g.contentWidthMm, `${paper}/${name}`).toBeCloseTo(g.sheetWidthMm - m.left - m.right, 6);
        expect(g.contentHeightMm, `${paper}/${name}`).toBeCloseTo(g.sheetHeightMm - m.top - m.bottom, 6);
      }
    }
  });

  it("carries the same gutter the preview would compute on its own", () => {
    for (const [name, m] of Object.entries(MARGIN_PRESETS)) {
      const g = sheetGeometry({ margins: name as keyof typeof MARGIN_PRESETS });
      expect(g.gutter, name).toEqual(
        gutterZones({ topMm: m.top, bottomMm: m.bottom, sheetGapMm: SHEET_GAP_MM }),
      );
      // The gap between two previewed pages is the bottom margin, the sheet
      // break, then the top margin. Nothing else, and nothing less.
      expect(g.gutter.gutterMm, name).toBe(m.bottom + SHEET_GAP_MM + m.top);
    }
  });

  it("leaves the footer its clearance on the document preset", () => {
    expect(sheetGeometry().gutter.footerPadBottomMm).toBe(FOOTER_FROM_EDGE_MM);
  });
});

describe("the document margin preset", () => {
  it("is the geometry the print shells used to hard-code", () => {
    expect(MARGIN_PRESETS.document).toEqual({ top: 14, right: 14, bottom: 20, left: 14 });
  });

  it("gives the footer band room for the clearance AND a line of text", () => {
    // gutterZones yields the clearance when the band cannot hold it; on this
    // preset it must not have to, or the strapline would sit on the paper edge.
    const z = sheetGeometry().gutter;
    expect(z.footerPadBottomMm).toBe(FOOTER_FROM_EDGE_MM);
    expect(z.footerBandMm - z.footerPadBottomMm).toBeGreaterThanOrEqual(4);
  });
});

describe("the screen sheet cannot drift from @page", () => {
  it("sizes the sheet from the very margins @page is given", () => {
    for (const surface of SURFACES) {
      for (const [name, m] of Object.entries(MARGIN_PRESETS)) {
        const css = pageRulesCss({ ...surface, margins: name as keyof typeof MARGIN_PRESETS });
        const rule = screenSheetRule(css);
        const g = sheetGeometry({ ...surface, margins: name as keyof typeof MARGIN_PRESETS });

        const label = `${surface.orientation}/${name}`;
        expect(declaration(rule, "width"), label).toBe(`${g.sheetWidthMm}mm`);
        expect(declaration(rule, "padding"), label).toBe(
          `${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm`,
        );
      }
    }
  });

  it("uses the identical padding string that @page uses for its margin", () => {
    // Stated as string equality on purpose: these are two renderings of one
    // decision, and the cheapest way for them to part company is for someone to
    // edit one of the two template literals.
    const css = pageRulesCss({ margins: "document" });
    const pageMargin = css.match(/@page \{ size: [^;]+; margin: ([^;]+);/)![1];
    expect(declaration(screenSheetRule(css), "padding")).toBe(pageMargin);
  });

  it("borders the sheet from the padding edge, so the column is the printed one", () => {
    // Without border-box the padding would be added OUTSIDE the 210mm, and the
    // text column would come out 28mm narrower than the printed one.
    expect(declaration(screenSheetRule(pageRulesCss({ margins: "document" })), "box-sizing")).toBe(
      "border-box",
    );
  });

  it("is screen-only, because on paper @page already supplies both", () => {
    const css = pageRulesCss({ margins: "document" });
    // Physical padding in print would double every margin — 14mm from @page plus
    // 14mm from the sheet — which is the failure this guards.
    for (const block of balancedBlocks(css, "@media print {")) {
      expect(block).not.toContain(DOCUMENT_SHEET_CLASS);
    }
    expect(css).toContain(`@media screen { .${DOCUMENT_SHEET_CLASS}`);
  });

  it("keeps the @page block itself untouched by the addition", () => {
    // The screen rule is emitted as a sibling, never inside @page: a stray brace
    // there takes the document's whole margin down with it, silently.
    const css = pageRulesCss({ margins: "document", footerLeft: "Practice" });
    const pageStart = css.indexOf("@page {");
    let depth = 0;
    let pageEnd = -1;
    for (let i = pageStart; i < css.length; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}" && --depth === 0) {
        pageEnd = i;
        break;
      }
    }
    expect(pageEnd).toBeGreaterThan(pageStart);
    expect(css.slice(pageStart, pageEnd)).not.toContain(DOCUMENT_SHEET_CLASS);
    expect(css.indexOf(`@media screen { .${DOCUMENT_SHEET_CLASS}`)).toBeGreaterThan(pageEnd);
  });
});
