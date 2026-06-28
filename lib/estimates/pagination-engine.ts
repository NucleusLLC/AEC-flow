/**
 * Smart Estimation Page-Break Engine
 * ----------------------------------
 * A measurement-first ("two-pass") layout system for the Estimation Sheet.
 *
 *   Pass 1 — `simulateReportPages()` measures every block, then `paginateBlocks()`
 *            decides page breaks at professional, logical locations.
 *   Pass 2 — the React renderer (`<EstimatePrintDoc>`) draws each page exactly
 *            according to the returned pagination map. It never recalculates a
 *            break; it only obeys the measured Y positions.
 *
 * All heights are expressed in CSS pixels so the renderer can lay blocks out at
 * the exact heights the engine measured — which is what guarantees that a row is
 * never cut, text never overlaps, and the model and the render always agree.
 *
 * This module is pure (no React / no DOM) so it can be unit-tested in isolation.
 */

/* ------------------------------------------------------------------ *
 * 1. Core types
 * ------------------------------------------------------------------ */

export type TextSize = "small" | "normal" | "medium";

export interface TextSizeProfile {
  fontSize: number;
  lineHeight: number;
  titleHeight: number;
  categoryHeaderHeight: number;
  subcategoryHeaderHeight: number;
  itemRowMinHeight: number;
  subtotalRowHeight: number;
  totalRowHeight: number;
  verticalPadding: number;
}

export interface PageSettings {
  pageWidth: number;
  pageHeight: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  headerHeight: number;
  footerHeight: number;
}

export interface LayoutContext {
  textSize: TextSize;
  profile: TextSizeProfile;
  pageSettings: PageSettings;
  printableHeight: number;
  printableWidth: number;
  /** Optional visual-debug toggle, consumed by the renderer overlay. */
  showPageBreakDebug?: boolean;
}

export type BlockType =
  | "reportTitle"
  | "sheetTitle"
  | "category"
  | "subcategory"
  | "itemRow"
  | "assembly"
  | "subtotal"
  | "total"
  | "grandTotal"
  | "notes"
  | "signature"
  | "timeline"
  | "phaseTable"
  | "chart";

export interface MeasuredBlock {
  id: string;
  type: BlockType;
  height: number;
  keepTogether: boolean;
  minRowsAfterHeader?: number;
  children?: MeasuredBlock[];
  data: any;

  /* --- assigned during pagination (Pass 1 output) --- */
  /** Y offset (px) of this block from the top of the page body. */
  y?: number;
  /** True when this header is a repeated "(continued)" copy on a later page. */
  continued?: boolean;
  /** Human-readable label the renderer prints (e.g. "Concrete Works (continued)"). */
  label?: string;
  /** Force this block to begin a fresh page (e.g. the General Conditions section). */
  pageBreakBefore?: boolean;
}

export interface PageLayout {
  pageNumber: number;
  blocks: MeasuredBlock[];
  usedHeight: number;
  remainingHeight: number;
}

/* ------------------------------------------------------------------ *
 * 2. Text-size profiles + constants
 * ------------------------------------------------------------------ */

/** Small buffer (px) reserved at the bottom of every page to avoid edge collision. */
export const PAGE_BREAK_SAFETY_BUFFER = 8;

const PROFILES: Record<TextSize, TextSizeProfile> = {
  small: {
    fontSize: 8,
    lineHeight: 10,
    titleHeight: 22,
    categoryHeaderHeight: 20,
    subcategoryHeaderHeight: 18,
    itemRowMinHeight: 16,
    subtotalRowHeight: 18,
    totalRowHeight: 20,
    verticalPadding: 4,
  },
  normal: {
    fontSize: 10,
    lineHeight: 12,
    titleHeight: 28,
    categoryHeaderHeight: 24,
    subcategoryHeaderHeight: 22,
    itemRowMinHeight: 20,
    subtotalRowHeight: 22,
    totalRowHeight: 24,
    verticalPadding: 6,
  },
  medium: {
    fontSize: 12,
    lineHeight: 15,
    titleHeight: 34,
    categoryHeaderHeight: 30,
    subcategoryHeaderHeight: 26,
    itemRowMinHeight: 24,
    subtotalRowHeight: 26,
    totalRowHeight: 30,
    verticalPadding: 8,
  },
};

/** (1) Returns the profile for Small / Normal / Medium. */
export function getTextSizeProfile(textSize: TextSize): TextSizeProfile {
  return PROFILES[textSize] ?? PROFILES.normal;
}

/* ------------------------------------------------------------------ *
 * 3. Geometry + text measurement
 * ------------------------------------------------------------------ */

/** (2) Printable area inside margins / running header / footer. */
export function calculatePrintableArea(pageSettings: PageSettings): {
  printableHeight: number;
  printableWidth: number;
} {
  const printableHeight =
    pageSettings.pageHeight -
    pageSettings.marginTop -
    pageSettings.marginBottom -
    pageSettings.headerHeight -
    pageSettings.footerHeight;
  const printableWidth =
    pageSettings.pageWidth - pageSettings.marginLeft - pageSettings.marginRight;
  return {
    printableHeight: Math.max(0, printableHeight),
    printableWidth: Math.max(0, printableWidth),
  };
}

/** (3) Estimate how many lines a string wraps into inside a column. */
export function estimateWrappedLineCount(
  text: string,
  columnWidth: number,
  fontSize: number,
): number {
  const value = text ?? "";
  const averageCharacterWidth = fontSize * 0.5;
  const charactersPerLine = Math.max(1, Math.floor(columnWidth / averageCharacterWidth));
  const lineCount = Math.ceil(value.length / charactersPerLine);
  return Math.max(1, lineCount);
}

/** (4) Height a wrapped string occupies in a column. */
export function calculateTextHeight(
  text: string,
  columnWidth: number,
  profile: TextSizeProfile,
): number {
  return (
    estimateWrappedLineCount(text, columnWidth, profile.fontSize) * profile.lineHeight +
    profile.verticalPadding
  );
}

/* ------------------------------------------------------------------ *
 * Report data model (input to the engine)
 * ------------------------------------------------------------------ */

export interface ReportItem {
  id: string;
  code?: string;
  description: string;
  unit?: string;
  note?: string;
  /** Alternating-band parity (true = shaded) — set by the adapter, used by the renderer. */
  zebra?: boolean;
  /** Pre-formatted cell values the renderer prints (kept opaque to the engine). */
  values?: Record<string, string | number>;
}

export interface ReportSubcategory {
  id: string;
  name: string;
  items: ReportItem[];
}

export interface ReportSubtotal {
  id: string;
  label: string;
  values?: Record<string, string | number>;
}

export interface ReportCategory {
  id: string;
  code?: string;
  name: string;
  items: ReportItem[];
  subcategories?: ReportSubcategory[];
  subtotal?: ReportSubtotal;
  /** Pre-formatted section total, shown bold on the shaded header row. */
  subtotalDisplay?: string;
  /** Section share of direct cost, e.g. "24%", shown on the shaded header row. */
  sharePctDisplay?: string;
  /** Begin this section on a fresh page (used for General Conditions). */
  pageBreakBefore?: boolean;
}

export interface ReportAssembly {
  id: string;
  name: string;
  items: ReportItem[];
}

export interface GrandTotalRow {
  label: string;
  value: string;
  /** Emphasised rows (Grand Total) use `totalRowHeight`; others `subtotalRowHeight`. */
  emphasize?: boolean;
}

export interface ReportData {
  reportTitle?: string;
  sheetTitle?: string;
  categories: ReportCategory[];
  assemblies?: ReportAssembly[];
  grandTotal?: {
    rows: GrandTotalRow[];
    notes?: string;
    signature?: boolean;
    /** Optional heading rendered above the rows (e.g. "Cost Summary"). */
    title?: string;
  };
  /** Force the end-of-report grand total onto its own page (a guaranteed concluding summary). */
  grandTotalPageBreak?: boolean;
  notes?: string;
  /** Pre-measured blocks placed FIRST (after titles), e.g. the financial recap page. */
  leadBlocks?: MeasuredBlock[];
  /** Detail-breakdown sections (e.g. General Conditions, Imported Materials) placed
   *  AFTER the grand total — so the Cost Summary concludes the main estimation sheet
   *  and these read as appendices. Paginated row-by-row exactly like `categories`. */
  appendixCategories?: ReportCategory[];
  /** Pre-measured appendix blocks (e.g. Timeline / Phase Disbursement), appended last. */
  extraBlocks?: MeasuredBlock[];
}

export interface ColumnWidths {
  description: number;
  unit?: number;
  note?: number;
  [key: string]: number | undefined;
}

/* ------------------------------------------------------------------ *
 * 4. Measurement engine — data → MeasuredBlock tree
 * ------------------------------------------------------------------ */

/** (5) Measure one item row: tallest of its wrapped cells, floored at the min. */
export function measureItemRow(
  row: ReportItem,
  context: LayoutContext,
  columnWidths: ColumnWidths,
): MeasuredBlock {
  const { profile } = context;
  const descriptionHeight = calculateTextHeight(
    row.description,
    columnWidths.description,
    profile,
  );
  const unitHeight =
    row.unit && columnWidths.unit
      ? calculateTextHeight(row.unit, columnWidths.unit, profile)
      : 0;
  const noteHeight = row.note
    ? calculateTextHeight(row.note, columnWidths.note ?? columnWidths.description, profile)
    : 0;

  const height = Math.max(
    profile.itemRowMinHeight,
    descriptionHeight,
    unitHeight,
    // A note prints as an extra line *under* the description, so add it on.
    row.note ? descriptionHeight + noteHeight - profile.verticalPadding : 0,
  );

  return {
    id: `row-${row.id}`,
    type: "itemRow",
    height,
    keepTogether: true,
    data: row,
  };
}

/** (6) Measure a category: header + (sub)rows + subtotal. May split between rows. */
export function measureCategory(
  category: ReportCategory,
  context: LayoutContext,
  columnWidths: ColumnWidths,
): MeasuredBlock {
  const { profile } = context;
  const children: MeasuredBlock[] = [];

  if (category.subcategories && category.subcategories.length > 0) {
    for (const sub of category.subcategories) {
      children.push({
        id: `subcat-${sub.id}`,
        type: "subcategory",
        height: profile.subcategoryHeaderHeight,
        keepTogether: true,
        minRowsAfterHeader: Math.min(3, sub.items.length),
        data: sub,
      });
      for (const item of sub.items) {
        children.push(measureItemRow(item, context, columnWidths));
      }
    }
  } else {
    for (const item of category.items) {
      children.push(measureItemRow(item, context, columnWidths));
    }
  }

  if (category.subtotal) {
    children.push(measureSubtotalBlock(category.subtotal, context));
  }

  const itemRowCount = children.filter((c) => c.type === "itemRow").length;
  const childHeight = children.reduce((sum, c) => sum + c.height, 0);

  return {
    id: `cat-${category.id}`,
    type: "category",
    // The category block's own height is its header; children are placed after it.
    height: profile.categoryHeaderHeight,
    keepTogether: false,
    // Keep the header with at least 3 rows — or all of them if fewer exist.
    minRowsAfterHeader: Math.min(3, itemRowCount),
    children,
    pageBreakBefore: category.pageBreakBefore,
    data: { ...category, totalHeight: profile.categoryHeaderHeight + childHeight },
  };
}

/** (7) Measure an assembly: stays together unless taller than a full page. */
export function measureAssembly(
  assembly: ReportAssembly,
  context: LayoutContext,
  columnWidths: ColumnWidths,
): MeasuredBlock {
  const { profile } = context;
  const children = assembly.items.map((item) => measureItemRow(item, context, columnWidths));
  const childHeight = children.reduce((sum, c) => sum + c.height, 0);
  const height = profile.categoryHeaderHeight + childHeight;

  return {
    id: `asm-${assembly.id}`,
    type: "assembly",
    height,
    // Kept together by default; the paginator splits it only if it exceeds a page.
    keepTogether: height <= context.printableHeight,
    minRowsAfterHeader: Math.min(3, children.length),
    children,
    data: { ...assembly, headerHeight: profile.categoryHeaderHeight },
  };
}

/** (8) Measure a subtotal row. Orphan avoidance is handled in the paginator. */
export function measureSubtotalBlock(
  subtotal: ReportSubtotal,
  context: LayoutContext,
): MeasuredBlock {
  return {
    id: `sub-${subtotal.id}`,
    type: "subtotal",
    height: context.profile.subtotalRowHeight,
    keepTogether: true,
    data: subtotal,
  };
}

/** (9) Measure the grand-total block (subtotal/discount/tax/total + notes + signature). */
export function measureGrandTotalBlock(
  summary: NonNullable<ReportData["grandTotal"]>,
  context: LayoutContext,
  columnWidths?: ColumnWidths,
): MeasuredBlock {
  const { profile } = context;
  let height = summary.title ? profile.titleHeight : 0;
  for (const row of summary.rows) {
    height += row.emphasize ? profile.totalRowHeight : profile.subtotalRowHeight;
  }
  if (summary.notes) {
    const width = columnWidths?.description ?? context.printableWidth;
    height += calculateTextHeight(summary.notes, width, profile);
  }
  if (summary.signature) {
    height += profile.totalRowHeight * 2; // name + date / signature lines
  }

  return {
    id: "grand-total",
    type: "grandTotal",
    height,
    keepTogether: true,
    data: summary,
  };
}

/* ------------------------------------------------------------------ *
 * 5. Pagination engine
 * ------------------------------------------------------------------ */

function newPage(pageNumber: number, printableHeight: number): PageLayout {
  return { pageNumber, blocks: [], usedHeight: 0, remainingHeight: printableHeight };
}

/** Available height after reserving the safety buffer. */
function availableHeight(page: PageLayout): number {
  return page.remainingHeight - PAGE_BREAK_SAFETY_BUFFER;
}

function placeBlock(page: PageLayout, block: MeasuredBlock): void {
  block.y = page.usedHeight;
  page.blocks.push(block);
  page.usedHeight += block.height;
  page.remainingHeight -= block.height;
}

function popBlock(page: PageLayout): MeasuredBlock | undefined {
  const block = page.blocks.pop();
  if (block) {
    page.usedHeight -= block.height;
    page.remainingHeight += block.height;
  }
  return block;
}

function continuationLabel(name: string): string {
  return `${name} (continued)`;
}

/** (10) Core smart pagination: turn a flat block list into laid-out pages. */
export function paginateBlocks(blocks: MeasuredBlock[], context: LayoutContext): PageLayout[] {
  const { printableHeight } = context;
  const pages: PageLayout[] = [];
  let current = newPage(1, printableHeight);

  /** Start a fresh page (no leading blank pages). */
  const breakPage = () => {
    if (current.blocks.length > 0) {
      pages.push(current);
      current = newPage(pages.length + 1, printableHeight);
    }
  };

  const headerClone = (block: MeasuredBlock, name: string): MeasuredBlock => ({
    ...block,
    id: `${block.id}-cont-${current.pageNumber}`,
    children: undefined,
    continued: true,
    label: continuationLabel(name),
  });

  const placeCategory = (catBlock: MeasuredBlock) => {
    const rows = catBlock.children ?? [];
    const flowRows = rows.filter((r) => r.type !== "subtotal");
    const subtotal = rows.find((r) => r.type === "subtotal");
    const minRows = catBlock.minRowsAfterHeader ?? Math.min(3, flowRows.length);
    const firstRowsHeight = flowRows
      .slice(0, minRows)
      .reduce((sum, r) => sum + r.height, 0);

    // Rule: header must not start unless it + its first rows fit.
    if (catBlock.height + firstRowsHeight > availableHeight(current)) breakPage();

    placeBlock(current, { ...catBlock, children: undefined });
    let rowsForCatOnPage: MeasuredBlock[] = [];

    for (const child of rows) {
      if (child.type === "subtotal") {
        placeSubtotal(child, catBlock, rowsForCatOnPage);
        rowsForCatOnPage = [];
        continue;
      }
      // Never cut a row: page-break before it if it doesn't fit, repeat the header.
      if (child.height > availableHeight(current)) {
        breakPage();
        placeBlock(current, headerClone(catBlock, catBlock.data?.name ?? "Section"));
        rowsForCatOnPage = [];
      }
      placeBlock(current, child);
      rowsForCatOnPage.push(child);
    }
  };

  const placeSubtotal = (
    subtotal: MeasuredBlock,
    catBlock: MeasuredBlock,
    rowsForCatOnPage: MeasuredBlock[],
  ) => {
    if (subtotal.height <= availableHeight(current)) {
      placeBlock(current, subtotal);
      return;
    }
    // Orphan avoidance: carry the previous up-to-2 rows onto the next page too.
    const moveCount = Math.min(2, rowsForCatOnPage.length);
    const moved: MeasuredBlock[] = [];
    for (let i = 0; i < moveCount; i++) {
      const popped = popBlock(current);
      if (popped) moved.unshift(popped);
    }
    breakPage();
    placeBlock(current, headerClone(catBlock, catBlock.data?.name ?? "Section"));
    for (const r of moved) placeBlock(current, r);
    placeBlock(current, subtotal);
  };

  const placeAssembly = (asmBlock: MeasuredBlock) => {
    if (asmBlock.height <= printableHeight) {
      if (asmBlock.height > availableHeight(current)) breakPage();
      placeBlock(current, { ...asmBlock });
      return;
    }
    splitOversizedBlockInto(asmBlock, context, current, pages, breakPage, () => current).forEach(
      () => undefined,
    );
    // splitOversized mutates pages/current via the shared helpers below.
  };

  const placeGrandTotal = (gtBlock: MeasuredBlock) => {
    if (gtBlock.height > printableHeight) {
      // Extremely tall summary — split at row boundaries.
      splitGrandTotal(gtBlock, context, {
        get current() {
          return current;
        },
        breakPage,
        place: (b) => placeBlock(current, b),
      });
      return;
    }
    if (gtBlock.height > availableHeight(current)) breakPage();
    placeBlock(current, gtBlock);
  };

  const placeKeepTogether = (block: MeasuredBlock) => {
    if (block.height > printableHeight) {
      splitGrandTotal(block, context, {
        get current() {
          return current;
        },
        breakPage,
        place: (b) => placeBlock(current, b),
      });
      return;
    }
    if (block.height > availableHeight(current)) breakPage();
    placeBlock(current, block);
  };

  for (const block of blocks) {
    // Honour an explicit "start on a new page" request (e.g. General Conditions).
    if (block.pageBreakBefore) breakPage();
    switch (block.type) {
      case "category":
        placeCategory(block);
        break;
      case "assembly":
        placeAssembly(block);
        break;
      case "grandTotal":
        placeGrandTotal(block);
        break;
      default:
        placeKeepTogether(block);
    }
  }

  if (current.blocks.length > 0 || pages.length === 0) pages.push(current);
  return pages;
}

/**
 * (11) Split a block taller than one page. Splits ONLY at child-row boundaries,
 * repeats the parent header with a "(continued)" label on every page, and never
 * cuts a row or text. Returns the produced page fragments for completeness.
 */
export function splitOversizedBlock(
  block: MeasuredBlock,
  context: LayoutContext,
): PageLayout[] {
  const { printableHeight } = context;
  const pages: PageLayout[] = [];
  let current = newPage(1, printableHeight);
  const header = { ...block, children: undefined };
  const name = block.data?.name ?? "Section";

  placeBlock(current, header);
  for (const child of block.children ?? []) {
    if (child.height > availableHeight(current)) {
      pages.push(current);
      current = newPage(pages.length + 1, printableHeight);
      placeBlock(current, {
        ...header,
        id: `${header.id}-cont-${pages.length + 1}`,
        continued: true,
        label: continuationLabel(name),
      });
    }
    placeBlock(current, child);
  }
  if (current.blocks.length > 0) pages.push(current);
  return pages;
}

/** Internal: split an oversized assembly straight into the live page stream. */
function splitOversizedBlockInto(
  block: MeasuredBlock,
  context: LayoutContext,
  _current: PageLayout,
  pages: PageLayout[],
  breakPage: () => void,
  getCurrent: () => PageLayout,
): MeasuredBlock[] {
  const name = block.data?.name ?? "Assembly";
  const header = { ...block, children: undefined };
  breakPage();
  placeBlock(getCurrent(), header);
  for (const child of block.children ?? []) {
    if (child.height > availableHeight(getCurrent())) {
      breakPage();
      placeBlock(getCurrent(), {
        ...header,
        id: `${header.id}-cont-${getCurrent().pageNumber}`,
        continued: true,
        label: continuationLabel(name),
      });
    }
    placeBlock(getCurrent(), child);
  }
  return [];
}

/** Internal: split a grand-total / notes block at row boundaries (rare). */
function splitGrandTotal(
  block: MeasuredBlock,
  context: LayoutContext,
  io: { current: PageLayout; breakPage: () => void; place: (b: MeasuredBlock) => void },
): void {
  // For a block with no children, emit as-is (cannot meaningfully split a single row).
  io.breakPage();
  io.place(block);
}

/* ------------------------------------------------------------------ *
 * 6. Pass-1 entry point
 * ------------------------------------------------------------------ */

/** (12) Pass 1 — measure the whole report and compute the pagination map. */
export function simulateReportPages(
  reportData: ReportData,
  context: LayoutContext,
  columnWidths: ColumnWidths,
): PageLayout[] {
  const { profile } = context;
  const blocks: MeasuredBlock[] = [];

  if (reportData.reportTitle) {
    blocks.push({
      id: "report-title",
      type: "reportTitle",
      height: profile.titleHeight + profile.verticalPadding,
      keepTogether: true,
      data: { title: reportData.reportTitle },
    });
  }
  if (reportData.sheetTitle) {
    blocks.push({
      id: "sheet-title",
      type: "sheetTitle",
      height: profile.titleHeight,
      keepTogether: true,
      data: { title: reportData.sheetTitle },
    });
  }

  // Lead blocks (e.g. the recap page) print before the detailed breakdown.
  for (const block of reportData.leadBlocks ?? []) {
    blocks.push(block);
  }

  for (const category of reportData.categories) {
    blocks.push(measureCategory(category, context, columnWidths));
  }
  for (const assembly of reportData.assemblies ?? []) {
    blocks.push(measureAssembly(assembly, context, columnWidths));
  }

  if (reportData.grandTotal) {
    const gt = measureGrandTotalBlock(reportData.grandTotal, context, columnWidths);
    if (reportData.grandTotalPageBreak) gt.pageBreakBefore = true;
    blocks.push(gt);
  }
  if (reportData.notes) {
    blocks.push({
      id: "report-notes",
      type: "notes",
      height: calculateTextHeight(reportData.notes, context.printableWidth, profile),
      keepTogether: true,
      data: { notes: reportData.notes },
    });
  }

  // Detail-breakdown appendices (General Conditions, Imported Materials) print AFTER the
  // grand total so the Cost Summary concludes the main estimation sheet. Each carries its
  // own pageBreakBefore, so it begins on a fresh page after the summary.
  for (const category of reportData.appendixCategories ?? []) {
    blocks.push(measureCategory(category, context, columnWidths));
  }

  // Appendix sections (Timeline / Phase Disbursement) — already measured by the caller.
  for (const block of reportData.extraBlocks ?? []) {
    blocks.push(block);
  }

  return paginateBlocks(blocks, context);
}

/* ------------------------------------------------------------------ *
 * 7. Validation engine
 * ------------------------------------------------------------------ */

export interface ValidationError {
  blockId?: string;
  pageNumber: number;
  message: string;
  expectedHeight?: number;
  availableHeight?: number;
}

/** Verify the pagination obeys every professional rule; logs (never silently fails). */
export function validatePagination(
  pages: PageLayout[],
  context: LayoutContext,
): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const { printableHeight } = context;

  for (const page of pages) {
    // No page may exceed the printable height.
    if (page.usedHeight > printableHeight + 0.5) {
      errors.push({
        pageNumber: page.pageNumber,
        message: "Page used height exceeds printable height",
        expectedHeight: page.usedHeight,
        availableHeight: printableHeight,
      });
    }

    page.blocks.forEach((block, index) => {
      // No zero-height block.
      if (!block.height || block.height <= 0) {
        errors.push({
          blockId: block.id,
          pageNumber: page.pageNumber,
          message: `Block has non-positive height (${block.height})`,
        });
      }

      // A header (category/subcategory) must not be the last block on a page (orphan),
      // unless it is the very last block of the whole report.
      if (block.type === "category" || block.type === "subcategory") {
        const isLastOnPage = index === page.blocks.length - 1;
        const isLastPage = page.pageNumber === pages.length;
        if (isLastOnPage && !(isLastPage && index === page.blocks.length - 1 && pages.length === page.pageNumber && page.blocks.length === 1)) {
          if (isLastOnPage) {
            errors.push({
              blockId: block.id,
              pageNumber: page.pageNumber,
              message: "Header is orphaned at the bottom of the page",
            });
          }
        }
      }

      // A subtotal/total must not be the first block on any page after the first
      // (i.e. orphaned at the top with no preceding rows), unless it follows a
      // repeated header.
      if ((block.type === "subtotal" || block.type === "total") && index === 0 && page.pageNumber > 1) {
        errors.push({
          blockId: block.id,
          pageNumber: page.pageNumber,
          message: "Subtotal/total is orphaned at the top of the page",
        });
      }
    });
  }

  // Each grand-total block must live entirely on a single page. There may legitimately
  // be more than one (e.g. the recap printed both up front and at the end), so we check
  // per block id rather than per type.
  const gtPagesById = new Map<string, Set<number>>();
  for (const page of pages) {
    for (const b of page.blocks) {
      if (b.type !== "grandTotal") continue;
      const set = gtPagesById.get(b.id) ?? new Set<number>();
      set.add(page.pageNumber);
      gtPagesById.set(b.id, set);
    }
  }
  for (const [id, set] of gtPagesById) {
    if (set.size > 1) {
      errors.push({ blockId: id, pageNumber: [...set][0], message: "Grand total block was split across pages" });
    }
  }

  if (errors.length > 0) {
    // Surface every failure loudly — do not silently fail.
    for (const e of errors) {
      // eslint-disable-next-line no-console
      console.error(
        `[pagination] page ${e.pageNumber}${e.blockId ? ` block ${e.blockId}` : ""}: ${e.message}` +
          (e.expectedHeight != null
            ? ` (expected ${e.expectedHeight}px / available ${e.availableHeight}px)`
            : ""),
      );
    }
  }

  return { valid: errors.length === 0, errors };
}
