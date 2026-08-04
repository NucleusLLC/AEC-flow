import { describe, expect, it } from "vitest";

import { cssString, footerMarginBoxesCss, PAGE_NUMBER_WIDTH_MM } from "./footer-boxes";
import { FOOTER_FROM_EDGE_MM } from "./preview-geometry";

/**
 * The bottom margin boxes are shared by every document in the app, including the
 * two protected systems that cannot take the rest of the print stylesheet. They
 * are also the single most fragile string the app emits: a malformed at-rule here
 * takes the whole `@page` block down with it, and the failure is SILENT — the
 * document simply prints flush to the paper edge. So this asserts the shape, not
 * just the numbers.
 */

const A4 = { pageWidthMm: 210, marginLeftMm: 14, marginRightMm: 14, marginBottomMm: 14 };
/** The Schedule programme sheet: A3 landscape at a 10mm margin. */
const A3_LANDSCAPE = { pageWidthMm: 420, marginLeftMm: 10, marginRightMm: 10, marginBottomMm: 10 };

/**
 * Balanced braces in the fragment, so it cannot escape the @page block it sits in.
 *
 * Counts the way a CSS parser does: braces inside a quoted string are inert text,
 * not block delimiters, and a backslash escapes the next character. A naive
 * counter reports a hostile strapline as unbalanced when the emitted CSS is in
 * fact perfectly safe — which is the false alarm this function exists to avoid.
 */
function braceDelta(css: string): number {
  let d = 0;
  let inString = false;
  let escaped = false;

  for (const ch of css) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") d += 1;
    if (ch === "}") d -= 1;
  }
  return d;
}

function widthsMm(css: string): number[] {
  return [...css.matchAll(/width: ([\d.]+)mm/g)].map((m) => Number(m[1]));
}

describe("footerMarginBoxesCss", () => {
  it("gives both boxes explicit widths that sum exactly to the strip", () => {
    // The whole reason the widths are explicit: left to Chrome's proportional
    // sizing a long strapline squeezes the counter and "Page 1 of 3" wraps.
    const css = footerMarginBoxesCss({ ...A4, footerLeft: "Practice · aec-flow.com" });
    const strip = A4.pageWidthMm - A4.marginLeftMm - A4.marginRightMm;

    expect(widthsMm(css).reduce((a, b) => a + b, 0)).toBe(strip);
  });

  it("reserves the page-number width regardless of how long the footer line is", () => {
    const short = footerMarginBoxesCss({ ...A4, footerLeft: "X" });
    const long = footerMarginBoxesCss({
      ...A4,
      footerLeft: "A very long practice strapline that would otherwise eat the whole strip",
    });

    expect(widthsMm(short)[1]).toBe(PAGE_NUMBER_WIDTH_MM);
    expect(widthsMm(long)[1]).toBe(PAGE_NUMBER_WIDTH_MM);
  });

  it("yields the footer clearance on a margin too thin to hold it", () => {
    // Schedule prints at a 10mm margin: 8mm of clearance plus a line of text does
    // not fit, so the clearance gives way rather than pushing the line out of band.
    const thin = footerMarginBoxesCss({ ...A3_LANDSCAPE, footerLeft: "Practice" });
    expect(thin).toContain(`padding-bottom: ${A3_LANDSCAPE.marginBottomMm - 4}mm;`);

    const deep = footerMarginBoxesCss({ ...A4, marginBottomMm: 20, footerLeft: "Practice" });
    expect(deep).toContain(`padding-bottom: ${FOOTER_FROM_EDGE_MM}mm;`);
  });

  it("never emits a negative clearance", () => {
    const css = footerMarginBoxesCss({ ...A4, marginBottomMm: 2, footerLeft: "Practice" });
    expect(css).toContain("padding-bottom: 0mm;");
    // No negative measurement anywhere: a `-2mm` padding is silently ignored by
    // the browser, so it would look like the clamp worked when it had not.
    expect(css).not.toMatch(/:\s*-[\d.]/);
  });

  it("emits the counter with the paged-media page counters and no wrapping", () => {
    const css = footerMarginBoxesCss({ ...A4 });
    expect(css).toContain('content: "Page " counter(page) " of " counter(pages);');
    expect(css).toContain("white-space: nowrap;");
  });

  it("omits a box that was not asked for, and both when neither was", () => {
    expect(footerMarginBoxesCss({ ...A4, pageNumbers: false })).toBe("");
    expect(footerMarginBoxesCss({ ...A4, footerLeft: "P", pageNumbers: false })).not.toContain(
      "@bottom-right",
    );
    expect(footerMarginBoxesCss({ ...A4 })).not.toContain("@bottom-left");
  });

  it("gives the footer the whole strip when the counter is suppressed", () => {
    const css = footerMarginBoxesCss({ ...A4, footerLeft: "Practice", pageNumbers: false });
    expect(widthsMm(css)).toEqual([A4.pageWidthMm - A4.marginLeftMm - A4.marginRightMm]);
  });

  it("stays brace-balanced for every combination", () => {
    for (const opts of [
      { ...A4 },
      { ...A4, footerLeft: "Practice" },
      { ...A4, footerLeft: "Practice", pageNumbers: false },
      { ...A4, pageNumbers: false },
      { ...A3_LANDSCAPE, footerLeft: "Practice" },
    ]) {
      expect(braceDelta(footerMarginBoxesCss(opts))).toBe(0);
    }
  });

  it("cannot be escaped by a quote or a closing brace in the footer text", () => {
    // A practice could legitimately store a strapline containing a quote. If it
    // terminated the content string, the @page block would lose its margin and the
    // document would print to the paper edge with no warning at all.
    const hostile = 'Practice " } @page { margin: 0 } /*';
    const css = footerMarginBoxesCss({ ...A4, footerLeft: hostile });

    expect(braceDelta(css)).toBe(0);
    expect(css).toContain('\\"');
    // The injected at-rule must be inert text inside the content string, not a rule.
    expect(css).not.toMatch(/content: "[^"\\]*"\s*\}/);
  });

  it("escapes a backslash before it can escape the closing quote", () => {
    expect(cssString('a\\')).toBe('"a\\\\"');
    expect(braceDelta(footerMarginBoxesCss({ ...A4, footerLeft: 'a\\' }))).toBe(0);
  });

  it("does not let the counter width exceed a very narrow strip", () => {
    const narrow = footerMarginBoxesCss({
      pageWidthMm: 60,
      marginLeftMm: 14,
      marginRightMm: 14,
      marginBottomMm: 14,
      footerLeft: "Practice",
    });
    const strip = 60 - 14 - 14;
    expect(widthsMm(narrow).reduce((a, b) => a + b, 0)).toBe(strip);
    expect(widthsMm(narrow).every((w) => w >= 0)).toBe(true);
  });
});
