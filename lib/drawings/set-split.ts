/**
 * Splitting a bound set into sheets — the PURE arithmetic.
 *
 * A dropped "issue set" PDF of forty pages is forty sheets, and a register
 * that files it as one sheet called page 1 has indexed one fortieth of what
 * arrived. Autodesk Construction Cloud splits on upload; so does this. The
 * pdf-lib work (copying a page into a document of its own) lives in
 * `lib/server/pdf-pages.ts`; what is decided here is WHICH pages, in WHAT
 * batches, under WHAT names — all of which is testable without a PDF.
 */

import { splitExtension } from "./filename";

/**
 * Above this many pages the set is filed as ONE drawing with a warning, as
 * before. Not a technical ceiling: the split runs in batches, so it could go
 * on. It is a review ceiling — the user confirms every proposed row, and a
 * screen of 200 rows is not a review, it is a scroll. A set that big is better
 * split by discipline first.
 */
export const MAX_SET_PAGES = 80;

/**
 * Pages copied out per server call. Each call downloads the whole set again
 * (serverless functions keep nothing between calls) and the copy is
 * proportional to the page's own resources, so the batch size trades the
 * number of round trips against how long one call can run.
 */
export const SPLIT_BATCH_PAGES = 4;

/** Is this a set worth splitting? One page is a sheet; past the cap it is a document. */
export function shouldSplitSet(pageCount: number | null | undefined): boolean {
  const n = Number(pageCount);
  return Number.isInteger(n) && n > 1 && n <= MAX_SET_PAGES;
}

/** `[from, to]` inclusive 1-based page ranges covering `1..pageCount`. */
export function pageBatches(pageCount: number, batchSize = SPLIT_BATCH_PAGES): Array<[number, number]> {
  const n = Math.max(0, Math.floor(Number(pageCount) || 0));
  const size = Math.max(1, Math.floor(Number(batchSize) || 1));
  const out: Array<[number, number]> = [];
  for (let from = 1; from <= n; from += size) {
    out.push([from, Math.min(n, from + size - 1)]);
  }
  return out;
}

/**
 * The filename a split page is registered under.
 *
 * `Issue-Set-Rev-C.pdf` page 7 of 40 becomes `Issue-Set-Rev-C-p07.pdf`: the
 * set's name survives so the sheet can be traced, the page is zero-padded to
 * the set's width so the register sorts in page order, and the extension is
 * always `.pdf` because that is what the page IS once copied out — whatever
 * the set was called.
 */
export function pageFilename(setFilename: string, page: number, pageCount: number): string {
  const { base } = splitExtension(String(setFilename ?? "").trim() || "set.pdf");
  const width = Math.max(2, String(Math.max(1, Math.floor(pageCount))).length);
  const n = String(Math.max(1, Math.floor(page))).padStart(width, "0");
  const stem = (base || "set").slice(0, 200);
  return `${stem}-p${n}.pdf`;
}
