/**
 * Page geometry emitted by `PageRules`, asserted as a string.
 *
 * WHY THIS EXISTS. The footer repair put two margin-box at-rules — `@bottom-left`
 * and `@bottom-right`, each with an explicit width — inside the same `@page`
 * block as the `margin` shorthand that sets the document's page margins. If one
 * of those at-rules were ever malformed, or emitted before the shorthand, a
 * browser's error recovery can drop the shorthand with it, and the whole
 * document then prints flush to the paper edge with no margin at all.
 *
 * That failure is silent in every automated surface this repository has: the
 * layout still renders, the tests still pass, and only a printed sheet shows it.
 * The route was measured under headless Chrome and the margins were intact
 * (14mm left, 13.8mm right, 14mm top on the printed PDF) — these assertions pin
 * that result so the next edit to the margin boxes cannot quietly undo it.
 *
 * The assertions are on the SHAPE of the rule, not on a golden string: the point
 * is that the margin declaration survives whatever the margin boxes do, and that
 * the two boxes still sum to the strip between the page's left and right
 * margins, which is what keeps "Page N of M" on one line.
 */
import { describe, it, expect } from "vitest";
import { pageRulesCss, PAGE_NUMBER_WIDTH_MM } from "@/components/print/page-rules";
import { MARGIN_PRESETS, pageSizeMm, printableAreaMm } from "@/lib/documents/tokens";

/** The single `@page { … }` block, margin boxes and all. */
function pageBlock(css: string): string {
  const start = css.indexOf("@page {");
  expect(start, "no @page rule was emitted").toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (let i = start; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(start, i + 1);
    }
  }
  throw new Error("the @page block is not brace-balanced");
}

/** The `margin: …` shorthand of the page box itself, ignoring the margin boxes. */
function pageMargin(css: string): string | null {
  const block = pageBlock(css);
  // Everything before the first nested at-rule is the page box's own declarations.
  const own = block.slice(0, block.indexOf("@") > 0 ? block.indexOf("@bottom") : block.length);
  const m = own.match(/margin:\s*([^;}]+)/);
  return m ? m[1].trim() : null;
}

/** The geometry the Construction Admin print shell actually asks for. */
const SHELL_MARGINS = { top: 14, right: 14, bottom: 20, left: 14 };
const FOOTER =
  "AEC Flow™ | Intelligent Project Management ::: Architecture • Engineering • " +
  "Construction • Procurement • Cost Management • AI Automation ::: www.AEC-Flow.com";

describe("@page margins survive the footer margin boxes", () => {
  it("emits the margin shorthand for an explicit millimetre box", () => {
    const css = pageRulesCss({ margins: SHELL_MARGINS, footerLeft: FOOTER });
    expect(pageMargin(css)).toBe("14mm 14mm 20mm 14mm");
  });

  it("emits the margin shorthand for every named preset", () => {
    for (const [name, m] of Object.entries(MARGIN_PRESETS)) {
      const css = pageRulesCss({ margins: name as keyof typeof MARGIN_PRESETS, footerLeft: FOOTER });
      expect(pageMargin(css), name).toBe(`${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm`);
    }
  });

  it("declares the margin BEFORE any margin box, so recovery from a bad box cannot drop it", () => {
    const css = pageRulesCss({ margins: SHELL_MARGINS, footerLeft: FOOTER });
    const block = pageBlock(css);
    expect(block.indexOf("margin:")).toBeLessThan(block.indexOf("@bottom-left"));
    expect(block.indexOf("margin:")).toBeLessThan(block.indexOf("@bottom-right"));
  });

  it("keeps the @page block brace-balanced with both margin boxes present", () => {
    const block = pageBlock(pageRulesCss({ margins: SHELL_MARGINS, footerLeft: FOOTER }));
    const opens = (block.match(/\{/g) ?? []).length;
    const closes = (block.match(/\}/g) ?? []).length;
    expect(opens).toBe(3); // @page, @bottom-left, @bottom-right
    expect(closes).toBe(opens);
  });

  it("holds the margin even when the footer text carries CSS metacharacters", () => {
    // An unescaped quote or brace in a practice's footer line would terminate the
    // content string early and close the @page block on the browser's behalf.
    const hostile = 'Practice "X" }  @page { margin: 0 } /* ';
    const css = pageRulesCss({ margins: SHELL_MARGINS, footerLeft: hostile });
    expect(pageMargin(css)).toBe("14mm 14mm 20mm 14mm");
    const block = pageBlock(css);
    expect((block.match(/\{/g) ?? []).length).toBe(3);
    expect(block).toContain('\\"X\\"');
  });

  it("is unaffected by turning the margin boxes off", () => {
    const bare = pageRulesCss({ margins: SHELL_MARGINS, pageNumbers: false });
    expect(pageMargin(bare)).toBe("14mm 14mm 20mm 14mm");
    expect(bare).not.toContain("@bottom-");
  });
});

describe("the bottom margin strip is divided, never overflowed", () => {
  it("splits the strip between the footer line and the page number", () => {
    const css = pageRulesCss({ margins: SHELL_MARGINS, footerLeft: FOOTER });
    const footerW = Number(css.match(/@bottom-left \{[^}]*width:\s*([\d.]+)mm/)![1]);
    const numberW = Number(css.match(/@bottom-right \{[^}]*width:\s*([\d.]+)mm/)![1]);
    const strip = pageSizeMm({ paper: "A4", orientation: "portrait" }).width
      - SHELL_MARGINS.left - SHELL_MARGINS.right;

    expect(strip).toBe(printableAreaMm({ paper: "A4", orientation: "portrait", margins: SHELL_MARGINS }).width);
    expect(numberW).toBe(PAGE_NUMBER_WIDTH_MM);
    expect(footerW + numberW).toBeCloseTo(strip, 6);
  });

  it("never gives the page number more than the whole strip", () => {
    // A hypothetical narrow page: the reservation must not go negative on the
    // footer box, which would make the width declaration invalid.
    const css = pageRulesCss({
      margins: { top: 10, right: 100, bottom: 10, left: 100 },
      footerLeft: FOOTER,
    });
    const footerW = Number(css.match(/@bottom-left \{[^}]*width:\s*([\d.]+)mm/)![1]);
    const numberW = Number(css.match(/@bottom-right \{[^}]*width:\s*([\d.]+)mm/)![1]);
    expect(footerW).toBeGreaterThanOrEqual(0);
    expect(numberW).toBeGreaterThan(0);
    expect(footerW + numberW).toBeCloseTo(10, 6);
  });

  it("holds the page number on one line", () => {
    const css = pageRulesCss({ margins: SHELL_MARGINS, footerLeft: FOOTER });
    const box = css.match(/@bottom-right \{[^}]*\}/)![0];
    expect(box).toContain('content: "Page " counter(page) " of " counter(pages)');
    expect(box).toContain("white-space: nowrap");
  });
});

describe("the sheet geometry the print shell hard-codes agrees with the tokens", () => {
  it("A4 less the shell's margins is the 182 x 263mm content box it lays out", () => {
    const area = printableAreaMm({ paper: "A4", orientation: "portrait", margins: SHELL_MARGINS });
    // components/construction-admin/print-shell.tsx: p-[14mm] on screen, and
    // <PagedPreview pageContentHeightMm={263} />.
    expect(area.width).toBeCloseTo(182, 6);
    expect(area.height).toBeCloseTo(263, 6);
  });
});
