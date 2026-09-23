"use client";

/**
 * One page of a PDF, rendered to a canvas by pdf.js, with its geometry reported
 * back so a markup layer can sit exactly on top of it.
 *
 * ─── WHY THE BYTES ARE FETCHED ONCE ─────────────────────────────────────────
 * The signed download URL lives five minutes (`DOWNLOAD_URL_TTL_SECONDS`). A
 * review takes longer than that. Streaming pages from the URL on demand would
 * start failing mid-session, so the file is fetched once into memory and the
 * pdf.js document is kept alive for as long as the studio is open. A 10 MB
 * sheet set is a fair price for a session that does not break at minute six.
 *
 * ─── WHY THE CANVAS IS OVERSAMPLED ──────────────────────────────────────────
 * A drawing is read by zooming into a door schedule at 4-point type. Rendering
 * at CSS resolution makes that unreadable, so the canvas is rendered at the
 * device pixel ratio (capped, or a 4K monitor at 400% zoom allocates a canvas
 * the browser refuses). The CSS size is what the markup layer measures, and the
 * two are deliberately different numbers.
 *
 * ─── THE WORKER ─────────────────────────────────────────────────────────────
 * pdf.js needs its worker script. It is resolved relative to this module so the
 * bundler emits it as an asset rather than us hosting a copy that drifts out of
 * step with the library version.
 */

import { useEffect, useRef, useState } from "react";
import type { PageView } from "@/lib/drawings/markup";

type PdfDocument = {
  numPages: number;
  getPage(n: number): Promise<PdfPage>;
  destroy(): Promise<void>;
};

type PdfPage = {
  getViewport(options: { scale: number }): { width: number; height: number };
  render(options: { canvasContext: CanvasRenderingContext2D; viewport: unknown; canvas?: HTMLCanvasElement }): {
    promise: Promise<void>;
    cancel(): void;
  };
};

/** Above this the canvas gets large enough that browsers start refusing it. */
const MAX_PIXEL_RATIO = 2;

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      return mod;
    });
  }
  return pdfjsPromise;
}

export type PdfPageProps = {
  /** The bytes, already fetched. Passed in rather than fetched here so the
   *  whole studio shares one document and one download. */
  data: ArrayBuffer | null;
  page: number;
  /** 1 = the page's own size. The studio owns zoom; this only renders. */
  zoom: number;
  rotation?: 0 | 90 | 180 | 270;
  onDocument?: (info: { pageCount: number }) => void;
  onView?: (view: PageView) => void;
  onError?: (message: string) => void;
};

export function PdfPageCanvas({
  data,
  page,
  zoom,
  rotation = 0,
  onDocument,
  onView,
  onError,
}: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const docRef = useRef<PdfDocument | null>(null);
  const [ready, setReady] = useState(false);

  // One document per file, torn down on unmount. Re-parsing the bytes per page
  // turn would make a 40-sheet set unusable.
  useEffect(() => {
    let cancelled = false;
    if (!data) return;

    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        // pdf.js transfers (neuters) the buffer it is given, so it gets a copy:
        // without this, turning back to page 1 finds an empty ArrayBuffer.
        const task = pdfjs.getDocument({ data: data.slice(0) });
        const doc = (await task.promise) as unknown as PdfDocument;
        if (cancelled) {
          await doc.destroy();
          return;
        }
        docRef.current = doc;
        onDocument?.({ pageCount: doc.numPages });
        setReady(true);
      } catch (err) {
        if (!cancelled) {
          onError?.(err instanceof Error ? err.message : "The drawing could not be opened.");
        }
      }
    })();

    return () => {
      cancelled = true;
      const doc = docRef.current;
      docRef.current = null;
      setReady(false);
      void doc?.destroy();
    };
    // `onDocument`/`onError` are intentionally not dependencies: they are
    // callbacks from the parent and re-parsing the document when one is
    // re-created would reload the file on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel(): void } | null = null;
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!ready || !doc || !canvas) return;

    (async () => {
      try {
        const pageNumber = Math.min(Math.max(1, page), doc.numPages);
        const pdfPage = await doc.getPage(pageNumber);
        if (cancelled) return;

        const base = pdfPage.getViewport({ scale: 1 });
        const ratio = Math.min(MAX_PIXEL_RATIO, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
        const cssWidth = base.width * zoom;
        const cssHeight = base.height * zoom;

        canvas.width = Math.round(cssWidth * ratio);
        canvas.height = Math.round(cssHeight * ratio);
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;

        const context = canvas.getContext("2d");
        if (!context) return;
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);

        const viewport = pdfPage.getViewport({ scale: zoom * ratio });
        const task = pdfPage.render({ canvasContext: context, viewport, canvas });
        renderTask = task;
        await task.promise;
        if (cancelled) return;

        // The two sizes the markup layer needs: what is on screen, and what the
        // page measures in its own units.
        onView?.({
          widthPx: cssWidth,
          heightPx: cssHeight,
          widthPt: base.width,
          heightPt: base.height,
        });
      } catch (err) {
        // A cancelled render is the normal result of turning a page quickly.
        const message = err instanceof Error ? err.message : "";
        if (!cancelled && !/cancel/i.test(message)) onError?.(message || "The page could not be drawn.");
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, page, zoom, rotation]);

  return (
    <canvas
      ref={canvasRef}
      className="block bg-white shadow-[0_1px_3px_rgba(16,24,40,0.12)]"
      style={{ transform: rotation ? `rotate(${rotation}deg)` : undefined }}
      aria-label={`Drawing page ${page}`}
    />
  );
}
