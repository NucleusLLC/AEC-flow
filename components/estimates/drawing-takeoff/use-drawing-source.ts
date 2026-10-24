"use client";

import { useEffect, useState } from "react";
import {
  drawingFileUrlAction,
  estimateDrawingsAction,
  type EstimateDrawing,
} from "@/app/(app)/drawings/actions";

/** Keep register failures separate from a single file's download/render failure. */
export function useDrawingSource(
  projectId: string | null,
  bytesCache: Map<string, Promise<ArrayBuffer>>,
) {
  const [drawings, setDrawings] = useState<EstimateDrawing[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [listError, setListError] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const [drawingId, setDrawingId] = useState("");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [data, setData] = useState<ArrayBuffer | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!projectId) return;

    estimateDrawingsAction(projectId)
      .then(result => {
        if (cancelled) return;
        setLoaded(true);
        if (result.ok) {
          setDrawings(result.drawings);
          setDrawingId(result.drawings[0]?.id ?? "");
        } else {
          setListError(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoaded(true);
          setListError(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    if (!drawingId) return;

    let bytes = bytesCache.get(drawingId);
    if (!bytes) {
      bytes = (async () => {
        const result = await drawingFileUrlAction(drawingId);
        if (!result.ok) throw new Error();
        const response = await fetch(result.url);
        if (!response.ok) throw new Error();
        return response.arrayBuffer();
      })();
      bytesCache.set(drawingId, bytes);
      bytes.catch(() => {
        // A rejected older request must not evict a newer retry's cached bytes.
        if (bytesCache.get(drawingId) === bytes) bytesCache.delete(drawingId);
      });
    }

    bytes
      .then(buffer => {
        if (!cancelled) {
          setData(buffer);
          setPdfError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setPdfError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [drawingId, bytesCache, attempt]);

  function changePage(nextDrawing: string, nextPage: number) {
    if (nextDrawing !== drawingId) {
      setData(null);
      setPdfError(false);
      setPageCount(drawings.find(d => d.id === nextDrawing)?.pageCount ?? 1);
    }
    setDrawingId(nextDrawing);
    setPage(nextPage);
  }

  function retry() {
    // Also discard successful bytes when pdf.js could not parse or render them.
    bytesCache.delete(drawingId);
    setData(null);
    setPdfError(false);
    setAttempt(value => value + 1);
  }

  return {
    drawings,
    loaded,
    listError,
    pdfError,
    drawingId,
    page,
    pageCount,
    data,
    attempt,
    changePage,
    retry,
    setPageCount,
    onPdfError: () => setPdfError(true),
  };
}
