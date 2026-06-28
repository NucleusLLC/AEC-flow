/**
 * Self-checking verification for the Smart Page-Break Engine.
 * Run:  npx ts-node --compiler-options '{"module":"commonjs"}' scripts/verify-pagination.ts
 */
import {
  simulateReportPages,
  validatePagination,
  calculatePrintableArea,
  getTextSizeProfile,
  type TextSize,
  type LayoutContext,
  type PageSettings,
  type ReportData,
  type ColumnWidths,
} from "../lib/estimates/pagination-engine";

let failures = 0;
function check(name: string, cond: boolean) {
  // eslint-disable-next-line no-console
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) failures++;
}

const MM = 96 / 25.4;
function buildContext(textSize: TextSize): { ctx: LayoutContext; cols: ColumnWidths } {
  const profile = getTextSizeProfile(textSize);
  const pageSettings: PageSettings = {
    pageWidth: Math.round(210 * MM),
    pageHeight: Math.round(297 * MM),
    marginTop: Math.round(7 * MM),
    marginBottom: Math.round(11 * MM),
    marginLeft: Math.round(7 * MM),
    marginRight: Math.round(7 * MM),
    headerHeight: Math.round(profile.titleHeight + profile.lineHeight * 2 + profile.verticalPadding * 3),
    footerHeight: Math.round(profile.lineHeight + profile.verticalPadding * 2),
  };
  const { printableHeight, printableWidth } = calculatePrintableArea(pageSettings);
  return {
    ctx: { textSize, profile, pageSettings, printableHeight, printableWidth },
    cols: { description: Math.round(printableWidth * 0.3) },
  };
}

function makeReport(): ReportData {
  const mkItems = (prefix: string, n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `${prefix}-${i}`,
      code: `${prefix}.${i}`,
      description:
        i % 5 === 0
          ? `Long description item ${i} that wraps across multiple lines because it contains a great deal of specification detail and notes`
          : `Item ${i}`,
      unit: "m²",
      values: { qty: "10", total: "1,000" },
    }));
  return {
    sheetTitle: "Verification Project",
    categories: [
      { id: "c1", name: "Substructure", items: mkItems("a", 2), subtotal: { id: "c1", label: "Subtotal — Substructure" } },
      { id: "c2", name: "Superstructure", items: mkItems("b", 60), subtotal: { id: "c2", label: "Subtotal — Superstructure" } },
      { id: "c3", name: "Finishes", items: mkItems("c", 1), subtotal: { id: "c3", label: "Subtotal — Finishes" } },
    ],
    grandTotal: {
      rows: [
        { label: "Direct Cost", value: "AED 100,000" },
        { label: "Profit (10%)", value: "AED 10,000" },
        { label: "Grand Total", value: "AED 110,000", emphasize: true },
      ],
    },
  };
}

const report = makeReport();
const pageCounts: Record<TextSize, number> = { small: 0, normal: 0, medium: 0 };

for (const size of ["small", "normal", "medium"] as TextSize[]) {
  const { ctx, cols } = buildContext(size);
  const pages = simulateReportPages(report, ctx, cols);
  pageCounts[size] = pages.length;

  const { valid } = validatePagination(pages, ctx);
  check(`[${size}] validatePagination passes`, valid);

  // No page exceeds printable height.
  check(
    `[${size}] no page overflows printable height`,
    pages.every((p) => p.usedHeight <= ctx.printableHeight + 0.5),
  );

  // No category header orphaned at the bottom of a non-final page.
  const orphanHeader = pages.some((p, pi) => {
    const last = p.blocks[p.blocks.length - 1];
    return last && last.type === "category" && pi < pages.length - 1;
  });
  check(`[${size}] no category header orphaned at page bottom`, !orphanHeader);

  // No subtotal orphaned as the first block of a later page.
  const orphanSubtotal = pages.some(
    (p) => p.pageNumber > 1 && p.blocks[0]?.type === "subtotal",
  );
  check(`[${size}] no subtotal orphaned at page top`, !orphanSubtotal);

  // Grand total lives on exactly one page.
  const gtPages = pages.filter((p) => p.blocks.some((b) => b.type === "grandTotal")).length;
  check(`[${size}] grand total on exactly one page`, gtPages === 1);

  // Every item row is preserved (none dropped or duplicated by continuation).
  const itemRows = pages.reduce(
    (n, p) => n + p.blocks.filter((b) => b.type === "itemRow").length,
    0,
  );
  check(`[${size}] all 63 item rows preserved`, itemRows === 63);

  // No zero-height blocks.
  check(
    `[${size}] no zero-height blocks`,
    pages.every((p) => p.blocks.every((b) => b.height > 0)),
  );
}

// Smaller text fits more rows per page → fewer (or equal) pages than larger text.
check("small ≤ normal ≤ medium page counts", pageCounts.small <= pageCounts.normal && pageCounts.normal <= pageCounts.medium);

// --- Appendix ordering: the Cost Summary must conclude the main sheet, with
// General-Conditions/Imported-Materials breakdowns flowing AFTER it. ---
{
  const { ctx, cols } = buildContext("normal");
  const reportWithAppendix: ReportData = {
    ...makeReport(),
    appendixCategories: [
      {
        id: "general-conditions",
        name: "General Conditions / Overhead",
        pageBreakBefore: true,
        items: Array.from({ length: 4 }, (_, i) => ({
          id: `gc-${i}`,
          description: `General condition item ${i}`,
          unit: "mo",
          values: { qty: "6", total: "10,000" },
        })),
        subtotal: { id: "gc", label: "Subtotal — General Conditions / Overhead" },
      },
    ],
  };
  const pages = simulateReportPages(reportWithAppendix, ctx, cols);
  const flat = pages.flatMap((p) => p.blocks);
  const gtIndex = flat.findIndex((b) => b.type === "grandTotal");
  const appendixIndex = flat.findIndex((b) => b.id === "cat-general-conditions");
  check("appendix present after summary", gtIndex >= 0 && appendixIndex >= 0);
  check("grand total precedes the appendix sections", gtIndex < appendixIndex);
  // The appendix carries pageBreakBefore → it must start a page after the summary's page.
  const gtPage = pages.find((p) => p.blocks.some((b) => b.type === "grandTotal"))?.pageNumber ?? 0;
  const appendixPage = pages.find((p) => p.blocks.some((b) => b.id === "cat-general-conditions"))?.pageNumber ?? 0;
  check("appendix starts on a page at/after the summary page", appendixPage >= gtPage);
  const { valid: appendixValid } = validatePagination(pages, ctx);
  check("appendix report passes validation", appendixValid);
}
// eslint-disable-next-line no-console
console.log("page counts:", pageCounts);

if (failures > 0) {
  // eslint-disable-next-line no-console
  console.error(`\n${failures} check(s) FAILED`);
  process.exit(1);
} else {
  // eslint-disable-next-line no-console
  console.log("\nAll checks passed ✓");
}
