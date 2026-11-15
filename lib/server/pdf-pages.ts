/**
 * Cutting pages out of a PDF, server-side, with pdf-lib.
 *
 * Two jobs, one library:
 *
 *   1. SPLIT A SET. Each page of a bound set is copied into a one-page PDF of
 *      its own, so the register can hold it as the sheet it is. pdf-lib's
 *      `copyPages` carries the page's resources (fonts, images, xobjects) with
 *      it, so the copy is a self-contained sheet, not a reference to the set.
 *
 *   2. MAGNIFY THE TITLE BLOCK. A model that is shown an A1 sheet as one
 *      picture sees the title block as a few pixels — 2.5 mm lettering on an
 *      841 mm sheet is unreadable at any sane raster size. So alongside the
 *      whole page we hand it the right-hand strip and the bottom strip of the
 *      same page, CROPPED: a copy of the page whose media box is just that
 *      strip. The renderer then spends its pixels on the strip, and the
 *      lettering comes out several times larger. The strips are the same
 *      fractions `lib/drawings/region.ts` uses to pick text-layer items, for
 *      the same reason — that is where title blocks live.
 *
 * SERVER-ONLY: pdf-lib is pure JavaScript and would run in a browser, but the
 * bytes it works on come from the private bucket and never reach one.
 *
 * NEVER THROWS at the caller for a bad file: every function returns null on a
 * PDF it cannot open. Encrypted-but-openable files are read with
 * `ignoreEncryption` — a plot that was "protected" against editing is still a
 * sheet to register.
 */

import "server-only";
import { PDFDocument } from "pdf-lib";
import { DEFAULT_REGION_OPTIONS } from "@/lib/drawings/region";

/** A page copied into a document of its own. */
export type ExtractedPage = {
  pageNumber: number;
  bytes: Uint8Array;
};

async function open(bytes: Uint8Array): Promise<PDFDocument | null> {
  try {
    return await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  } catch {
    return null;
  }
}

/** How many pages, or null when the file will not open as a PDF. */
export async function countPages(bytes: Uint8Array): Promise<number | null> {
  const doc = await open(bytes);
  return doc ? doc.getPageCount() : null;
}

/**
 * Copy pages `from..to` (1-based, inclusive) each into its own PDF.
 *
 * Pages outside the document are skipped, not errors: the caller computed the
 * range from a page count it was told earlier, and a set that changed under
 * it is not something to crash over.
 */
export async function extractPages(bytes: Uint8Array, from: number, to: number): Promise<ExtractedPage[] | null> {
  const source = await open(bytes);
  if (!source) return null;
  const total = source.getPageCount();
  const first = Math.max(1, Math.floor(from));
  const last = Math.min(total, Math.floor(to));
  const out: ExtractedPage[] = [];
  for (let n = first; n <= last; n++) {
    const doc = await PDFDocument.create();
    const [page] = await doc.copyPages(source, [n - 1]);
    doc.addPage(page);
    out.push({ pageNumber: n, bytes: await doc.save({ useObjectStreams: true }) });
  }
  return out;
}

/** The whole page plus its two title-block strips, as separate one-page PDFs. */
export type TitleBlockViews = {
  /** Page 1 of the given document, alone. */
  fullPage: Uint8Array;
  /** The right-hand strip, cropped. Null when the page had no usable box. */
  rightStrip: Uint8Array | null;
  /** The bottom strip, cropped. */
  bottomStrip: Uint8Array | null;
};

type Box = { x: number; y: number; width: number; height: number };

/**
 * Crop a one-page document to `box`, in PDF user units, by setting BOTH the
 * media box and the crop box: viewers honour the crop box, rasterisers that
 * ignore it still honour the media box. The content stream is untouched —
 * everything outside the box simply has nowhere to be drawn.
 */
async function cropped(pageBytes: Uint8Array, box: Box): Promise<Uint8Array | null> {
  const doc = await open(pageBytes);
  if (!doc || doc.getPageCount() < 1) return null;
  const page = doc.getPage(0);
  page.setMediaBox(box.x, box.y, box.width, box.height);
  page.setCropBox(box.x, box.y, box.width, box.height);
  return doc.save({ useObjectStreams: true });
}

/**
 * Prepare what a model is shown for one sheet. `bytes` may be a multi-page
 * document; page 1 is the sheet (a split set hands in one-page documents).
 */
export async function titleBlockViews(bytes: Uint8Array): Promise<TitleBlockViews | null> {
  const first = await extractPages(bytes, 1, 1);
  const fullPage = first?.[0]?.bytes;
  if (!fullPage) return null;

  const doc = await open(fullPage);
  const page = doc?.getPage(0);
  if (!page) return { fullPage, rightStrip: null, bottomStrip: null };

  // The media box is where the page IS; a rotated page (common on plots from
  // AutoCAD, which land as portrait media boxes rotated 90°) has its visual
  // right-hand strip on a different edge. Rotation is read and the strips
  // chosen in VISUAL terms, so "right" and "bottom" mean what the viewer sees.
  const { x, y, width, height } = page.getMediaBox();
  if (!(width > 0) || !(height > 0)) return { fullPage, rightStrip: null, bottomStrip: null };
  const rotation = ((page.getRotation().angle % 360) + 360) % 360;

  const right = DEFAULT_REGION_OPTIONS.rightStrip;
  const bottom = DEFAULT_REGION_OPTIONS.bottomStrip;

  // Unrotated: right strip = high x; bottom strip = low y (PDF y grows upward).
  let rightBox: Box = { x: x + width * (1 - right), y, width: width * right, height };
  let bottomBox: Box = { x, y, width, height: height * bottom };
  if (rotation === 90) {
    // Visual right = high y, visual bottom = high x.
    rightBox = { x, y: y + height * (1 - right), width, height: height * right };
    bottomBox = { x: x + width * (1 - bottom), y, width: width * bottom, height };
  } else if (rotation === 180) {
    rightBox = { x, y, width: width * right, height };
    bottomBox = { x, y: y + height * (1 - bottom), width, height: height * bottom };
  } else if (rotation === 270) {
    rightBox = { x, y, width, height: height * right };
    bottomBox = { x, y, width: width * bottom, height };
  }

  const [rightStrip, bottomStrip] = await Promise.all([cropped(fullPage, rightBox), cropped(fullPage, bottomBox)]);
  return { fullPage, rightStrip, bottomStrip };
}
