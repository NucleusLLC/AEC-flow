/**
 * The ONLY impure module in `lib/drawings/`: reading bytes out of a PDF.
 *
 * It is an interface plus a factory, not a hard dependency, for three reasons:
 *
 *   1. The uncertain part of this feature is whether a sheet number can be
 *      READ OUT of a title block reliably. That question is answered by
 *      `titleblock.ts`, which is pure. Binding a PDF library into the module
 *      graph would make the interesting part untestable without fixtures that
 *      are megabytes of binary.
 *   2. The reader must run SERVER-SIDE ONLY. pdf.js and every repackaging of it
 *      is ~350 KB gzipped of worker code; shipping that to the browser to read
 *      six strings would be the largest single asset in this application. The
 *      interface makes the boundary explicit — a client component cannot
 *      accidentally import a reader, because the concrete reader is constructed
 *      at a server entry point and passed in.
 *   3. It keeps the choice reversible. See docs/drawings-intake/01-FEASIBILITY.md
 *      §5 for the evaluation; the short version is `unpdf` (a serverless build
 *      of pdf.js with no canvas and no worker file to host), with plain
 *      `pdfjs-dist/legacy` as the fallback if a direct dependency is preferred.
 *
 * NOTHING IS INSTALLED YET. `unavailablePdfTextReader` is the default and it
 * fails closed with an explanatory error. Wiring the real one is three lines,
 * written out in the feasibility doc.
 */

import type { PdfPageText, PdfTextItem } from "./region";

export type PdfDocumentText = {
  pageCount: number;
  pages: PdfPageText[];
  /**
   * False means "this PDF has no usable text layer" — i.e. it is a scan, or a
   * plot with all text converted to outlines. Nothing downstream can recover
   * metadata from it without OCR, which this stack does not have.
   */
  hasTextLayer: boolean;
  /** Total non-whitespace characters found across the pages that were read. */
  charCount: number;
};

/**
 * Below this many characters across the read pages, treat the document as
 * having no text layer. Not zero: scanned sheets are frequently wrapped with a
 * few characters of producer metadata or a stamped "SCANNED" watermark, and a
 * handful of characters cannot yield a sheet number anyway.
 */
export const TEXT_LAYER_CHAR_THRESHOLD = 16;

export type PdfReadOptions = {
  /** Read at most this many pages. Metadata lives on page 1 of each sheet. */
  maxPages?: number;
};

export interface PdfTextReader {
  /** Stable id for logging and for the evidence trail. */
  readonly id: string;
  read(bytes: Uint8Array, options?: PdfReadOptions): Promise<PdfDocumentText>;
}

export class PdfTextUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfTextUnavailableError";
  }
}

/**
 * The default. Fails closed rather than pretending a PDF has no text — the
 * difference between "we could not look" and "we looked and found nothing"
 * matters, because the second one means OCR and the first one means a missing
 * dependency.
 */
export const unavailablePdfTextReader: PdfTextReader = {
  id: "unavailable",
  async read(): Promise<PdfDocumentText> {
    throw new PdfTextUnavailableError(
      "No PDF text reader is configured. Install `unpdf` and construct a reader with " +
        "createUnpdfReader(() => import('unpdf')). See docs/drawings-intake/01-FEASIBILITY.md §5.",
    );
  },
};

/* ------------------------------------------------------------------ *
 * unpdf / pdf.js adapter
 * ------------------------------------------------------------------ */

/**
 * The slice of the unpdf (and pdf.js) surface this adapter uses, declared
 * structurally so the module does not have to be installed for this file to
 * type-check. `pdfjs-dist` satisfies the same shape via `getDocument().promise`.
 */
/**
 * One positioned string as pdf.js reports it.
 *
 * Every member is optional because this describes a FOREIGN type structurally —
 * see `PdfTextSourceModule` — and the adapter must survive a producer that omits
 * any of them.
 */
export type PdfSourceTextItem = {
  str?: string;
  /** pdf.js text matrix: [a, b, c, d, e, f] where e = x and f = y. */
  transform?: number[];
  width?: number;
  height?: number;
};

/**
 * `getTextContent().items` is NOT a homogeneous list. pdf.js interleaves
 * `TextItem` (a positioned string) with `TextMarkedContent` (a structure marker
 * carrying `{ type, id }` and no text at all), so the array is typed as
 * `unknown[]` here and narrowed by `asTextItem` below. Declaring it as the text
 * shape instead is what makes `unpdf`'s real types fail to satisfy this
 * interface — a marker has no property in common with a text item.
 */
export type PdfTextSourceModule = {
  getDocumentProxy(data: Uint8Array): Promise<{
    numPages: number;
    getPage(pageNumber: number): Promise<{
      getViewport(params: { scale: number }): { width: number; height: number };
      getTextContent(): Promise<{ items: readonly unknown[] }>;
    }>;
  }>;
};

/** A text item, or null for a structure marker / anything else. */
function asTextItem(raw: unknown): PdfSourceTextItem | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as PdfSourceTextItem;
  return typeof candidate.str === "string" ? candidate : null;
}

/**
 * Build a reader from a lazily loaded module. Pass `() => import("unpdf")` at a
 * server entry point. The loader is injected rather than imported here so the
 * dependency stays optional and so tests can supply a fake.
 */
export function createUnpdfReader(load: () => Promise<PdfTextSourceModule>): PdfTextReader {
  return {
    id: "unpdf",
    async read(bytes: Uint8Array, options: PdfReadOptions = {}): Promise<PdfDocumentText> {
      const mod = await load();
      const doc = await mod.getDocumentProxy(bytes);
      const limit = Math.max(1, Math.min(options.maxPages ?? 1, doc.numPages));

      const pages: PdfPageText[] = [];
      let charCount = 0;
      for (let n = 1; n <= limit; n++) {
        const page = await doc.getPage(n);
        const viewport = page.getViewport({ scale: 1 });
        const content = await page.getTextContent();
        const items: PdfTextItem[] = [];
        for (const entry of content.items ?? []) {
          const raw = asTextItem(entry);
          if (!raw) continue; // a structure marker, not text
          const text = raw.str ?? "";
          if (!text.trim()) continue;
          const t = Array.isArray(raw.transform) ? raw.transform : [];
          items.push({
            text,
            x: Number(t[4]) || 0,
            y: Number(t[5]) || 0,
            width: Number(raw.width) || 0,
            height: Number(raw.height) || 0,
          });
          charCount += text.trim().length;
        }
        pages.push({
          pageNumber: n,
          width: Number(viewport.width) || 0,
          height: Number(viewport.height) || 0,
          items,
        });
      }

      return {
        pageCount: doc.numPages,
        pages,
        hasTextLayer: charCount >= TEXT_LAYER_CHAR_THRESHOLD,
        charCount,
      };
    },
  };
}

/** A reader backed by fixed pages. For tests and for the accuracy harness. */
export function createStubReader(pages: PdfPageText[], pageCount = pages.length): PdfTextReader {
  const charCount = pages.reduce(
    (sum, p) => sum + p.items.reduce((s, i) => s + i.text.trim().length, 0),
    0,
  );
  return {
    id: "stub",
    async read(): Promise<PdfDocumentText> {
      return { pageCount, pages, hasTextLayer: charCount >= TEXT_LAYER_CHAR_THRESHOLD, charCount };
    },
  };
}
