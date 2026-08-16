/**
 * Reading a PDF's title block, server-side.
 *
 * This is the one place `unpdf` is loaded. It sits in `lib/server/` rather than
 * `lib/drawings/` on purpose: everything in `lib/drawings/` is pure and
 * importable from a client component, and `unpdf` is a repackaged pdf.js —
 * ~2 MB on disk, useless in a browser bundle, and it would drag Node built-ins
 * into any client graph that touched it. The import is dynamic as well as
 * server-only, so a route that never uploads a drawing never pays for it.
 *
 * WHAT THIS DOES, in order:
 *   1. Read page 1's positioned text with `createUnpdfReader` (pdf.js reports
 *      each item with its transform matrix, which is what makes step 2 possible).
 *   2. Narrow to the title-block region with `selectTitleBlockText()` — the
 *      right-hand and bottom strips, reassembled from PDF draw order into
 *      reading order. See lib/drawings/region.ts for why that step is not
 *      optional on a full-size sheet.
 *
 * WHAT IT NEVER DOES: throw at the caller. Every failure — a corrupt file, an
 * encrypted one, a reader that hangs, a PDF too large to hold in memory — comes
 * back as `{ ok: false, reason }`. An upload that saves with a weaker proposal
 * is strictly better than an upload that fails, and the user is confirming the
 * values by hand either way.
 *
 * A SCAN IS NOT A FAILURE. A PDF with no text layer returns `ok: true` with
 * `hasTextLayer: false` and empty text, because "we looked and found nothing"
 * has a different fix (OCR) from "we could not look" (a bug). The distinction
 * is carried all the way to the user — see docs/drawings-intake/01-FEASIBILITY.md §4.
 */

import "server-only";
import { createUnpdfReader, selectTitleBlockText } from "@/lib/drawings";

/**
 * How long the reader gets before we give up and fall back to the filename.
 * A one-page sheet parses in well under a second; anything approaching this is
 * a pathological file, and a hung parse would otherwise hold a serverless
 * invocation open until the platform kills it.
 */
export const PDF_READ_TIMEOUT_MS = 15_000;

/**
 * Do not attempt to parse a PDF larger than this. The whole buffer has to be
 * resident to parse it. A single plotted sheet is 1–10 MB; a file past this is
 * an issue set, and reading page 1 of an issue set is not worth the memory.
 */
export const PDF_PARSE_MAX_BYTES = 25 * 1024 * 1024;

export type TitleBlockRead =
  | {
      ok: true;
      /** Text of the title-block region, reassembled into reading order. */
      titleBlockText: string;
      /** False for a scan or a plot with outlined text. */
      hasTextLayer: boolean;
      /** Non-whitespace characters found across the pages read. */
      charCount: number;
      /** True when the strips were empty and the whole page was used instead. */
      usedWholePage: boolean;
      pageCount: number;
    }
  | { ok: false; reason: string };

function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms.`)), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Read the title block out of a PDF's bytes. Never rejects.
 */
export async function readTitleBlock(bytes: Uint8Array): Promise<TitleBlockRead> {
  if (!bytes || bytes.byteLength === 0) {
    return { ok: false, reason: "The file was empty." };
  }
  if (bytes.byteLength > PDF_PARSE_MAX_BYTES) {
    return {
      ok: false,
      reason: `The file is larger than the ${Math.round(PDF_PARSE_MAX_BYTES / (1024 * 1024))} MB parsing limit.`,
    };
  }

  try {
    const reader = createUnpdfReader(() => import("unpdf"));
    // Metadata lives on page 1 of a sheet. Reading more costs time and, on a
    // multi-sheet set, mixes two different title blocks into one proposal.
    const doc = await withTimeout(reader.read(bytes, { maxPages: 1 }), PDF_READ_TIMEOUT_MS, "Reading the PDF");

    const page = doc.pages[0];
    const region = page ? selectTitleBlockText(page) : { text: "", usedWholePage: false, itemCount: 0 };

    return {
      ok: true,
      titleBlockText: region.text,
      hasTextLayer: doc.hasTextLayer,
      charCount: doc.charCount,
      usedWholePage: region.usedWholePage,
      pageCount: doc.pageCount,
    };
  } catch (err) {
    const reason = err instanceof Error && err.message ? err.message : "The PDF could not be read.";
    return { ok: false, reason };
  }
}
