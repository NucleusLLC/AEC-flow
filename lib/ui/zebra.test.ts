import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

/**
 * LIST ZEBRA tripwire.
 *
 * Every on-screen register and row list carries the one shared treatment from
 * app/globals.css (`zebra-row` on the rows, or `zebra-list` on the container).
 * This scan reads the source off disk and fails when:
 *
 *   1. a screen renders a <tbody> without the shared class and is not named in
 *      the allow-list below, with its reason — i.e. someone added a register
 *      and forgot the stripe; or
 *   2. a screen paints its own stripe (`even:bg-*` / `odd:bg-*`) instead of
 *      using the shared one; or
 *   3. an allow-list entry has gone stale (the file is gone, or it has since
 *      adopted the shared class), so the list cannot rot; or
 *   4. the token values stop doing their job: text on a shaded row must be at
 *      least as legible as it already was on a hovered row, and stripe, hover
 *      and selected must stay visibly different from each other.
 */

const ROOT = resolve(__dirname, "../..");

/** Files that render a <tbody> and deliberately do NOT take the stripe. */
const NOT_STRIPED: Record<string, string> = {
  // PROTECTED Estimates system (docs/protected-estimates-files.md). The owner's
  // written request covers the Estimates project LIST only; these are the
  // editor and its tabs. The bill of quantities is colour-coded by column
  // group, the Take-Off is an editing grid, and the rest keep the banding they
  // shipped with rather than being edited without approval.
  "components/estimates/estimate-view.tsx": "protected: the Estimate editor's bill of quantities",
  "components/estimates/takeoff-view.tsx": "protected: the Take-Off editing grid",
  "components/estimates/budget-timeline-view.tsx": "protected: Estimates editor tab",
  "components/estimates/general-conditions-view.tsx": "protected: Estimates editor tab",
  "components/estimates/normset-view.tsx": "protected: Estimates editor tab",
  "components/estimates/price-list-view.tsx": "protected: Estimates editor tab",
  "components/estimates/rebar-calculator-view.tsx": "protected: Estimates editor tab",
  "components/estimates/copy-section-over-dialog.tsx": "protected: Estimates dialog (a checkbox picker)",
  // PROTECTED Schedule system (docs/protected-schedule-files.md).
  "components/schedule/budget-panel.tsx": "protected: Schedule budget panel beside the Gantt",

  // Sheets of paper shown on screen. A document looks the same in the preview
  // as it does printed, and print keeps its own rules.
  "components/estimates/estimate-document.tsx": "paper: printed estimate",
  "components/contracts/contract-document.tsx": "paper: contract",
  "components/meetings/meeting-document.tsx": "paper: meeting minutes",
  "components/proposals/proposal-document.tsx": "paper: proposal",
  "components/preview/document-preview.tsx": "paper: shared document preview",
  "components/finance/tax-report-view.tsx": "paper: the tax report is typeset as a sheet",
  "components/settings/document-control-form.tsx": "paper: title-block preview",
  "components/development/print-shell.tsx": "paper: development print shell",

  // Editing grids: every cell is an input, so the row is a form, not a list.
  "components/finance/invoice-form.tsx": "editing grid: invoice lines",
  "components/finance/credit-note-form.tsx": "editing grid: credit note lines",
  "components/finance/rate-table.tsx": "editing grid: hourly rates",
  "components/projects/phase-editor.tsx": "editing grid: project phases",

  // The office TV board has its own (military) palette and is read from across
  // a room; it does not use the app's tokens at all.
  "components/officedash/office-board.tsx": "TV board: own palette",
};

/** Directories that are paper, not screen. */
const SKIP_DIRS = ["app/print", "components/print"];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith(".tsx") && !name.endsWith(".test.tsx")) out.push(full);
  }
  return out;
}

const rel = (full: string) => relative(ROOT, full).split("\\").join("/");

const SCREENS = [...walk(join(ROOT, "app")), ...walk(join(ROOT, "components"))]
  .map((full) => ({ path: rel(full), src: readFileSync(full, "utf8") }))
  .filter((f) => !SKIP_DIRS.some((d) => f.path.startsWith(d + "/")));

const usesZebra = (src: string) => /\bzebra-(row|list)\b/.test(src);

describe("list zebra: every register uses the shared treatment", () => {
  it("finds the screens it is meant to scan", () => {
    expect(SCREENS.length).toBeGreaterThan(200);
    expect(SCREENS.some((f) => f.path === "components/estimates/project-list-view.tsx")).toBe(true);
  });

  it("stripes the Estimates project list, the one the owner named", () => {
    const f = SCREENS.find((s) => s.path === "components/estimates/project-list-view.tsx")!;
    expect(f.src).toMatch(/<tr [^\n]*className="[^"]*\bzebra-row\b/);
  });

  it("has no table without the shared stripe, outside the allow-list", () => {
    const missing = SCREENS.filter((f) => f.src.includes("<tbody"))
      .filter((f) => !usesZebra(f.src) && !(f.path in NOT_STRIPED))
      .map((f) => f.path);
    // A new register belongs on `zebra-row` (see LIST ZEBRA in app/globals.css).
    // Only add it to NOT_STRIPED if colour already means something in it.
    expect(missing).toEqual([]);
  });

  it("has no hand-rolled stripe outside the allow-list", () => {
    const own = SCREENS.filter((f) => /\b(even|odd):bg-/.test(f.src))
      .filter((f) => !(f.path in NOT_STRIPED))
      .map((f) => f.path);
    expect(own).toEqual([]);
  });

  it("keeps the allow-list honest", () => {
    for (const path of Object.keys(NOT_STRIPED)) {
      const f = SCREENS.find((s) => s.path === path);
      expect(f, `${path} is allow-listed but no longer exists`).toBeDefined();
      expect(f!.src.includes("<tbody"), `${path} no longer renders a table`).toBe(true);
      expect(usesZebra(f!.src), `${path} now uses the shared stripe; drop it from the allow-list`).toBe(false);
    }
  });

  it("never stripes paper", () => {
    const paper = [...walk(join(ROOT, "app/print")), ...walk(join(ROOT, "components/print"))]
      .filter((full) => /\bzebra-(row|list|hover|selected)\b/.test(readFileSync(full, "utf8")))
      .map(rel);
    expect(paper).toEqual([]);
  });
});

/* ------------------------------------------------------------------ tokens */

const CSS = readFileSync(join(ROOT, "app/globals.css"), "utf8");

/** The first `selector { … }` block: where the palette lives. */
function block(selector: string): string {
  const at = CSS.search(new RegExp(`(^|\\n)${selector.replace(".", "\\.")} \\{`));
  expect(at).toBeGreaterThanOrEqual(0);
  return CSS.slice(at, CSS.indexOf("}", at));
}

function token(css: string, name: string): string {
  const m = css.match(new RegExp(`--c-${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  expect(m, `--c-${name} must be a 6-digit hex in the palette block`).not.toBeNull();
  return m![1];
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Plain RGB distance — enough to say "these two fills are not the same". */
function distance(a: string, b: string): number {
  const [x, y] = [rgb(a), rgb(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

describe.each([
  ["light", ":root"],
  ["dark", ".dark"],
])("list zebra tokens, %s theme", (_theme, selector) => {
  const css = block(selector);
  const t = (name: string) => token(css, name);

  it("keeps text on a shaded row at least as legible as on today's hovered row", () => {
    // Before the shared stripe, the darkest thing list text sat on was a
    // hovered row (`hover:bg-surface-2`). The stripe must not be worse.
    for (const text of ["fg", "muted", "faint"]) {
      expect(contrast(t(text), t("zebra"))).toBeGreaterThanOrEqual(contrast(t(text), t("surface-2")) - 0.001);
    }
  });

  it("keeps body and secondary text at WCAG AA on a shaded row", () => {
    expect(contrast(t("fg"), t("zebra"))).toBeGreaterThanOrEqual(7);
    expect(contrast(t("muted"), t("zebra"))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps body text readable on hovered and selected rows", () => {
    expect(contrast(t("fg"), t("zebra-hover"))).toBeGreaterThanOrEqual(7);
    expect(contrast(t("fg"), t("zebra-selected"))).toBeGreaterThanOrEqual(7);
  });

  it("is a visible stripe, and hover and selected cannot be mistaken for it", () => {
    expect(t("zebra")).not.toBe(t("surface"));
    expect(distance(t("zebra-hover"), t("zebra"))).toBeGreaterThan(10);
    expect(distance(t("zebra-hover"), t("surface"))).toBeGreaterThan(10);
    expect(distance(t("zebra-selected"), t("zebra-hover"))).toBeGreaterThan(10);
    expect(distance(t("zebra-selected"), t("zebra"))).toBeGreaterThan(20);
  });
});

describe("list zebra rules", () => {
  it("counts data rows only, so header and detail rows never break the stripe", () => {
    expect(CSS).toContain(".zebra-row:nth-child(even of .zebra-row)");
  });

  it("switches the stripe off on paper", () => {
    const print = CSS.slice(CSS.indexOf("/* On paper a list is ink on white"));
    expect(print.slice(0, 600)).toMatch(/@media print \{[\s\S]*zebra-row[\s\S]*background-color: transparent;/);
  });
});
