"use client";

import { useEffect, useState } from "react";
import {
  X,
  Download,
  FileText,
  Presentation,
  Sheet,
  PencilRuler,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { firmName } from "@/lib/firm-identity";

/**
 * A REAL file behind a preview.
 *
 * `getUrl` mints the URL when the preview opens and not before. It is a
 * function, not a string, on purpose: these files live in a private bucket and
 * the only link to them is a short-lived signed URL. A URL held on a row, or
 * embedded in a list of rows the browser already has, is a copy of the drawing
 * handed out with no further checks — and it outlives the session that got it.
 * So: one call, on open, per document.
 *
 * `inline` says whether a BROWSER can render the bytes. PDFs yes; DWG, DXF and
 * RVT no, and the honest answer there is a download button, not a drawing of a
 * CAD viewport with the user's own file name written on it.
 */
export type PreviewFile = {
  getUrl: () => Promise<{ ok: true; url: string } | { ok: false; error: string }>;
  inline: boolean;
};

/** Minimal shape any module can build to get a quick preview. */
export type PreviewDoc = {
  name: string;
  fileType: string; // PDF, DOCX, PPTX, XLSX, DWG, RVT, PNG, JPG…
  sizeLabel?: string;
  meta?: { label: string; value: string }[];
  pages?: number;
  /**
   * Present only when there are bytes in storage. Omit it and the component
   * behaves exactly as it always has — the faux renderers below, which are what
   * the documents hub and the other callers still want for rows that have no
   * file yet.
   */
  file?: PreviewFile;
};

type Style = "paper" | "slides" | "sheet" | "cad" | "image";

function styleFor(fileType: string): Style {
  const t = fileType.toUpperCase();
  if (t === "PPTX" || t === "PPT" || t === "KEY") return "slides";
  if (t === "XLSX" || t === "XLS" || t === "CSV") return "sheet";
  if (t === "DWG" || t === "RVT" || t === "DXF" || t === "IFC") return "cad";
  if (t === "PNG" || t === "JPG" || t === "JPEG" || t === "SVG") return "image";
  return "paper"; // PDF, DOCX, default
}

const STYLE_ICON: Record<Style, typeof FileText> = {
  paper: FileText,
  slides: Presentation,
  sheet: Sheet,
  cad: PencilRuler,
  image: ImageIcon,
};

const DEFAULT_PAGES: Record<Style, number> = { paper: 4, slides: 6, sheet: 1, cad: 1, image: 1 };

type FileState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "error"; error: string };

export function DocumentPreview({ doc, onClose }: { doc: PreviewDoc | null; onClose: () => void }) {
  const style: Style = doc ? styleFor(doc.fileType) : "paper";
  const pages = doc?.pages ?? DEFAULT_PAGES[style];
  const [page, setPage] = useState(1);
  const [fileState, setFileState] = useState<FileState>({ status: "idle" });

  // Reset to the first page when a new document opens (state-during-render
  // pattern — avoids setState-in-effect).
  const [trackedDoc, setTrackedDoc] = useState(doc);
  if (doc !== trackedDoc) {
    setTrackedDoc(doc);
    setPage(1);
    // A signed URL belongs to exactly one document and expires; carrying one
    // across a change of document would at best render the wrong file. Set
    // during render, not in the effect below: the effect only ever writes state
    // from its async callbacks, which is what keeps it out of a cascading render.
    setFileState(doc?.file?.inline ? { status: "loading" } : { status: "idle" });
  }

  /**
   * Mint the signed URL on open. Not on mount, not on hover, not on the list
   * that produced the row — a link to a private drawing should not exist until
   * someone asks to look at it.
   */
  const inlineFile = doc?.file?.inline ? doc.file : null;
  useEffect(() => {
    if (!inlineFile) return;
    let live = true;
    inlineFile
      .getUrl()
      .then((result) => {
        if (!live) return;
        setFileState(
          result.ok ? { status: "ready", url: result.url } : { status: "error", error: result.error },
        );
      })
      .catch((err: unknown) => {
        if (!live) return;
        setFileState({
          status: "error",
          error: err instanceof Error && err.message ? err.message : "The file could not be opened.",
        });
      });
    return () => {
      live = false;
    };
  }, [inlineFile]);

  useEffect(() => {
    if (!doc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setPage((p) => Math.min(pages, p + 1));
      if (e.key === "ArrowLeft") setPage((p) => Math.max(1, p - 1));
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [doc, pages, onClose]);

  if (!doc) return null;
  const Icon = STYLE_ICON[style];
  const file = doc.file ?? null;
  // A real file takes over the stage completely: the faux renderers are for
  // rows that have no bytes, and drawing an imitation of a document we are
  // holding would be worse than useless.
  const paged = !file && (style === "paper" || style === "slides");

  async function openFile() {
    if (!file) return;
    const result = await file.getUrl();
    if (!result.ok) {
      setFileState({ status: "error", error: result.error });
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Toolbar */}
      <div
        className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <Icon className="h-5 w-5 text-white/80" />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{doc.name}</div>
          <div className="truncate text-[11px] text-white/60">
            {doc.fileType.toUpperCase()}
            {doc.sizeLabel ? ` · ${doc.sizeLabel}` : ""}
            {doc.meta?.length ? " · " + doc.meta.map((m) => `${m.label}: ${m.value}`).join(" · ") : ""}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={file ? openFile : undefined}
            disabled={!file}
            title={file ? "Download" : "No file is stored for this document"}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-sm font-medium text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Download</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Stage */}
      <div
        className="flex flex-1 items-center justify-center overflow-auto p-4 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {file ? (
          <RealFileStage doc={doc} file={file} state={fileState} onDownload={openFile} />
        ) : (
          <>
            {style === "paper" ? <PaperPreview page={page} /> : null}
            {style === "slides" ? <SlidesPreview page={page} pages={pages} /> : null}
            {style === "sheet" ? <SheetPreview /> : null}
            {style === "cad" ? <CadPreview name={doc.name} /> : null}
            {style === "image" ? <ImagePreview /> : null}
          </>
        )}
      </div>

      {/* Footer / pager */}
      <div
        className="flex shrink-0 items-center justify-center gap-4 border-t border-white/10 px-4 py-2.5 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {paged ? (
          <>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Previous page"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs tabular-nums text-white/80">
              {style === "slides" ? "Slide" : "Page"} {page} / {pages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page === pages}
              aria-label="Next page"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        ) : (
          <span className="text-[11px] text-white/50">
            {file?.inline
              ? "Showing the stored file. The link expires shortly after this preview closes."
              : file
                ? "The stored file is intact; only its format cannot be rendered here."
                : "Preview is representative — live rendering arrives with stored files."}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── The real thing ─────────────────────────────────────────── */

/**
 * The stage when there ARE bytes.
 *
 * Two outcomes, and the second one is the point of this component existing:
 *
 *   PDF — hand the signed URL to the browser's own PDF viewer in an `<iframe>`.
 *         No renderer to ship, no worker to host, and it is the same viewer the
 *         user already trusts for every other PDF they open.
 *
 *   DWG / DXF / RVT — say plainly that the browser cannot render it and offer
 *         the download. The alternative was a hand-drawn "CAD viewport" with
 *         the file's name in a fake title block, and showing an architect an
 *         invented drawing labelled with their own sheet number is worse than
 *         showing them nothing. See docs/drawings-intake/01-FEASIBILITY.md §5
 *         for why rendering these is not on the table in this stack.
 */
function RealFileStage({
  doc,
  file,
  state,
  onDownload,
}: {
  doc: PreviewDoc;
  file: PreviewFile;
  state: FileState;
  onDownload: () => void;
}) {
  if (!file.inline) {
    return (
      <div className="max-w-md rounded-xl border border-white/15 bg-white/5 p-8 text-center text-white">
        <PencilRuler className="mx-auto h-10 w-10 text-white/50" aria-hidden="true" />
        <p className="mt-4 text-sm font-medium">
          A {doc.fileType.toUpperCase()} file cannot be shown in a browser
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-white/60">
          The file is stored and intact — there is simply no way to render this format here.
          Download it and open it in your CAD application.
        </p>
        <button
          type="button"
          onClick={onDownload}
          className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/15 px-4 text-sm font-medium text-white transition-colors hover:bg-white/25"
        >
          <Download className="h-4 w-4" />
          Download {doc.fileType.toUpperCase()}
        </button>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="max-w-md rounded-xl border border-white/15 bg-white/5 p-8 text-center text-white">
        <FileText className="mx-auto h-10 w-10 text-white/50" aria-hidden="true" />
        <p className="mt-4 text-sm font-medium">This file could not be opened</p>
        <p className="mt-1.5 text-xs leading-relaxed text-white/60">{state.error}</p>
      </div>
    );
  }

  if (state.status !== "ready") {
    return <p className="text-sm text-white/60">Opening {doc.name}…</p>;
  }

  return (
    <iframe
      src={state.url}
      title={doc.name}
      className="h-full min-h-[60vh] w-full rounded-md border-0 bg-white shadow-2xl"
    />
  );
}

/* ── Faux renderers ─────────────────────────────────────────── */

const bar = (w: string, h = "h-2.5") => (
  <div className={`${h} rounded bg-gray-200`} style={{ width: w }} />
);

function PaperPreview({ page }: { page: number }) {
  const widths = ["92%", "98%", "85%", "95%", "70%", "90%", "60%"];
  return (
    <div className="aspect-[1/1.414] w-full max-w-[640px] overflow-hidden rounded-md bg-white shadow-2xl">
      <div className="h-2 w-full bg-[var(--color-brand)]" />
      <div className="space-y-5 p-8 sm:p-12">
        <div className="flex items-center justify-between">
          <div className="h-7 w-7 rounded bg-[var(--color-brand)]" />
          <div className="text-right">
            <div className="ml-auto h-2.5 w-24 rounded bg-gray-300" />
            <div className="ml-auto mt-1 h-2 w-16 rounded bg-gray-200" />
          </div>
        </div>
        <div className="h-4 w-2/3 rounded bg-gray-300" />
        <div className="space-y-2.5">
          {widths.map((w, i) => (
            <div key={i}>{bar(i % 3 === (page % 3) ? "55%" : w)}</div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3 pt-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2 rounded-md border border-gray-100 p-3">
              <div className="h-2 w-12 rounded bg-gray-200" />
              <div className="h-3 w-16 rounded bg-gray-300" />
            </div>
          ))}
        </div>
        <div className="space-y-2.5 pt-2">
          {widths.slice(0, 4).map((w, i) => (
            <div key={i}>{bar(w)}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SlidesPreview({ page, pages }: { page: number; pages: number }) {
  return (
    <div className="w-full max-w-[820px] space-y-3">
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex h-full flex-col p-8 sm:p-12">
          <div className="h-5 w-1/2 rounded bg-gray-800/80" />
          <div className="mt-2 h-2.5 w-1/3 rounded bg-[var(--color-brand)]" />
          <div className="mt-8 grid flex-1 grid-cols-2 gap-6">
            <div className="space-y-3">
              {["88%", "74%", "92%", "60%"].map((w, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[var(--color-brand)]" />
                  <div className="h-2.5 rounded bg-gray-200" style={{ width: w }} />
                </div>
              ))}
            </div>
            <div className="flex items-end gap-2 rounded-lg bg-gray-50 p-4">
              {[40, 70, 55, 90, 65].map((h, i) => (
                <div key={i} className="flex-1 rounded-t bg-[var(--color-brand)]/70" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-center gap-2">
        {Array.from({ length: pages }).map((_, i) => (
          <div
            key={i}
            className={`h-9 w-14 rounded border ${
              i + 1 === page ? "border-white bg-white/30" : "border-white/20 bg-white/10"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function SheetPreview() {
  const cols = ["A", "B", "C", "D", "E", "F"];
  const rows = Array.from({ length: 12 });
  return (
    <div className="w-full max-w-[760px] overflow-hidden rounded-lg bg-white shadow-2xl">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="w-10 border border-gray-200 bg-gray-100 p-1.5" />
            {cols.map((c) => (
              <th key={c} className="border border-gray-200 bg-gray-100 p-1.5 font-medium text-gray-500">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((_, r) => (
            <tr key={r}>
              <td className="border border-gray-200 bg-gray-100 p-1.5 text-center text-gray-400">{r + 1}</td>
              {cols.map((c, ci) => (
                <td key={c} className="border border-gray-200 p-1.5">
                  {r === 0 ? (
                    <div className="h-2.5 w-full rounded bg-gray-300" />
                  ) : ci > 2 && r % 2 === 0 ? (
                    <div className="ml-auto h-2 w-2/3 rounded bg-emerald-200" />
                  ) : (
                    <div className="h-2 rounded bg-gray-100" style={{ width: `${40 + ((r * 7 + ci * 13) % 55)}%` }} />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CadPreview({ name }: { name: string }) {
  return (
    <div className="aspect-[1.414/1] w-full max-w-[860px] overflow-hidden rounded-lg border border-white/15 bg-[#0e1726] shadow-2xl">
      <div className="relative h-full w-full p-4">
        <svg viewBox="0 0 400 280" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
          <g stroke="#7f9bd4" strokeWidth="1" fill="none" opacity="0.9">
            <rect x="40" y="40" width="320" height="200" />
            <rect x="40" y="40" width="320" height="200" strokeWidth="2" />
            <line x1="160" y1="40" x2="160" y2="240" />
            <line x1="40" y1="150" x2="360" y2="150" />
            <rect x="60" y="60" width="80" height="70" />
            <rect x="180" y="60" width="160" height="70" />
            <rect x="60" y="170" width="120" height="50" />
            <rect x="200" y="170" width="140" height="50" />
            <line x1="160" y1="95" x2="180" y2="95" strokeDasharray="4 3" />
            <circle cx="250" cy="185" r="18" />
          </g>
          <g stroke="#3f6f63" strokeWidth="1.5" fill="none">
            <line x1="40" y1="255" x2="120" y2="255" />
            <line x1="40" y1="251" x2="40" y2="259" />
            <line x1="120" y1="251" x2="120" y2="259" />
          </g>
        </svg>
        {/* Title block */}
        <div className="absolute bottom-4 right-4 w-48 border border-white/25 bg-[#0e1726]/90 p-2 text-[10px] text-white/80">
          <div className="truncate font-semibold text-white">{name}</div>
          <div className="mt-1 flex justify-between border-t border-white/15 pt-1">
            <span className="truncate">{firmName()}</span>
            <span>1:100</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ImagePreview() {
  return (
    <div className="flex aspect-video w-full max-w-[760px] items-center justify-center rounded-lg bg-gradient-to-br from-gray-200 to-gray-300 shadow-2xl">
      <ImageIcon className="h-16 w-16 text-gray-400" />
    </div>
  );
}
