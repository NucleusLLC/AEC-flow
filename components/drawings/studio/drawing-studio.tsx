"use client";

/**
 * The studio: a drawing, the redlines on it, and the conversation about it.
 *
 * ─── COLLABORATION IS ASYNCHRONOUS, ON PURPOSE ──────────────────────────────
 * Everyone sees everyone's marks; nobody sees a moving cursor. Live presence
 * would need Supabase Realtime, which authenticates as `anon` — the role
 * `prisma/sql/0012` deliberately stripped of every grant after the Data API
 * audit. Reopening that for cursor dots is a bad trade, so the studio polls
 * while the tab is visible and stops when it is not. The data model is shaped
 * so that adding presence later changes the transport, not the storage.
 *
 * ─── OPTIMISTIC, BUT HONEST ─────────────────────────────────────────────────
 * A mark appears the instant it is drawn and is reconciled with the row the
 * server returns. If the server refuses it, the mark is removed again and the
 * reason is shown — a redline that looks saved and is not is worse than one
 * that visibly failed.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Eraser,
  Highlighter,
  Maximize2,
  MessageSquarePlus,
  Minus,
  MousePointer2,
  Pencil,
  Ruler,
  Square,
  Circle,
  Stamp as StampIcon,
  Trash2,
  Type,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  MARKUP_COLOURS,
  STAMPS,
  calibrationFrom,
  type Calibration,
  type MarkupKind,
  type PageView,
  type Point,
} from "@/lib/drawings/markup";
import type { CommentDTO, MarkupDTO } from "@/lib/data/drawing-studio";
import { PdfPageCanvas } from "./pdf-page";
import { MarkupLayer, type DraftMarkup } from "./markup-layer";
import { CommentPanel } from "./comment-panel";
import {
  addCommentAction,
  addMarkupAction,
  clearMyMarkupsAction,
  listCommentsAction,
  listMarkupsAction,
  removeMarkupAction,
} from "@/app/(app)/drawings/studio/actions";
import { drawingFileUrlAction } from "@/app/(app)/drawings/actions";

/** How often the studio looks for other people's work. See the header. */
const POLL_MS = 20_000;

const ZOOM_STEPS = [0.25, 0.4, 0.55, 0.75, 1, 1.5, 2, 3, 4];

type Tool = MarkupKind | null;

const TOOLS: { tool: Tool; icon: LucideIcon; label: string }[] = [
  { tool: null, icon: MousePointer2, label: "Select" },
  { tool: "PEN", icon: Pencil, label: "Freehand" },
  { tool: "LINE", icon: Minus, label: "Line" },
  { tool: "ARROW", icon: ArrowUpRight, label: "Arrow" },
  { tool: "RECT", icon: Square, label: "Rectangle" },
  { tool: "ELLIPSE", icon: Circle, label: "Ellipse" },
  { tool: "CLOUD", icon: Cloud, label: "Revision cloud" },
  { tool: "HIGHLIGHT", icon: Highlighter, label: "Highlight" },
  { tool: "TEXT", icon: Type, label: "Text" },
  { tool: "STAMP", icon: StampIcon, label: "Stamp" },
  { tool: "MEASURE", icon: Ruler, label: "Measure" },
];

export type StudioDrawing = {
  id: string;
  code: string;
  title: string;
  revision: string;
  status: string;
  projectId: string;
  projectNumber: string;
  projectName: string;
  fileType: string;
  paperSize: string | null;
  paperOrientation: string | null;
  sheetType: string | null;
  pageCount: number | null;
};

export function DrawingStudio({
  drawing,
  initialMarkups,
  initialComments,
  team,
  currentUser,
}: {
  drawing: StudioDrawing;
  initialMarkups: MarkupDTO[];
  initialComments: CommentDTO[];
  team: { id: string; name: string }[];
  currentUser: { id: string; name: string };
}) {
  const router = useRouter();

  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(drawing.pageCount ?? 1);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [view, setView] = useState<PageView | null>(null);

  const [tool, setTool] = useState<Tool>(null);
  const [colour, setColour] = useState<string>(MARKUP_COLOURS[0]);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [stamp, setStamp] = useState<string>(STAMPS[0]);
  const [calibration, setCalibration] = useState<Calibration | null>(null);
  const [calibrating, setCalibrating] = useState(false);

  const [markups, setMarkups] = useState<MarkupDTO[]>(initialMarkups);
  const [comments, setComments] = useState<CommentDTO[]>(initialComments);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hiddenAuthors, setHiddenAuthors] = useState<string[]>([]);
  const [commentMode, setCommentMode] = useState(false);
  const [pendingPin, setPendingPin] = useState<Point | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  /** Fit happens once, on the first page that renders. After that the zoom is
   *  the user's — re-fitting on every page turn would undo their choice. */
  const fittedRef = useRef(false);

  /* ---------------- the file ---------------- */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await drawingFileUrlAction(drawing.id);
      if (cancelled) return;
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      try {
        // Fetched once, held in memory: the signed URL expires in five minutes
        // and a review does not.
        const response = await fetch(result.url);
        if (!response.ok) throw new Error(`The file could not be downloaded (${response.status}).`);
        const buffer = await response.arrayBuffer();
        if (!cancelled) setBytes(buffer);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "The file could not be downloaded.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [drawing.id]);

  /* ---------------- other people's work ---------------- */

  const refresh = useCallback(async () => {
    const [m, c] = await Promise.all([listMarkupsAction(drawing.id), listCommentsAction(drawing.id)]);
    if (m.ok) setMarkups(m.markups);
    if (c.ok) setComments(c.comments);
  }, [drawing.id]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);

  /* ---------------- marks ---------------- */

  const onCreate = useCallback(
    async (draft: DraftMarkup) => {
      setError(null);

      // A text mark needs its words before it is worth storing.
      let text = draft.text ?? null;
      if (draft.kind === "TEXT" || draft.kind === "CALLOUT") {
        text = window.prompt(draft.kind === "TEXT" ? "Note" : "Callout")?.trim() || null;
        if (!text) return;
      }

      const optimistic: MarkupDTO = {
        id: `pending-${Date.now()}`,
        drawingId: drawing.id,
        page,
        kind: draft.kind,
        geometry: draft.geometry,
        colour: draft.colour,
        strokeWidth: draft.strokeWidth,
        text,
        mmPerPoint: draft.kind === "MEASURE" ? (calibration?.mmPerPoint ?? null) : null,
        authorId: currentUser.id,
        authorName: currentUser.name,
        createdAt: new Date().toISOString(),
        canDelete: true,
      };
      setMarkups((prev) => [...prev, optimistic]);

      const result = await addMarkupAction({
        drawingId: drawing.id,
        page,
        kind: draft.kind,
        geometry: draft.geometry,
        colour: draft.colour,
        strokeWidth: draft.strokeWidth,
        text,
        mmPerPoint: optimistic.mmPerPoint,
      });

      setMarkups((prev) =>
        result.ok
          ? prev.map((m) => (m.id === optimistic.id ? result.markup : m))
          : prev.filter((m) => m.id !== optimistic.id),
      );
      if (!result.ok) setError(result.error);
    },
    [drawing.id, page, calibration, currentUser],
  );

  const onDelete = useCallback(async (id: string) => {
    setMarkups((prev) => prev.filter((m) => m.id !== id));
    setSelectedId(null);
    const result = await removeMarkupAction(id);
    if (!result.ok) {
      setError(result.error);
      void refreshMarkups();
    }
    async function refreshMarkups() {
      const m = await listMarkupsAction(id);
      if (m.ok) setMarkups(m.markups);
    }
  }, []);

  const clearMine = useCallback(async () => {
    if (!window.confirm("Remove every mark you made on this page?")) return;
    const mine = markups.filter((m) => m.authorId === currentUser.id && m.page === page);
    setMarkups((prev) => prev.filter((m) => !mine.some((x) => x.id === m.id)));
    const result = await clearMyMarkupsAction(drawing.id, page);
    if (!result.ok) {
      setError(result.error);
      void refresh();
    }
  }, [markups, currentUser.id, page, drawing.id, refresh]);

  /* ---------------- comments ---------------- */

  const onPinComment = useCallback((at: Point) => {
    setPendingPin(at);
    setCommentMode(false);
  }, []);

  const addNote = useCallback(
    async (
      body: string,
      at: Point | null,
      assignedToId: string | null,
      parentId?: string | null,
    ) => {
      const result = await addCommentAction({
        drawingId: drawing.id,
        page,
        x: at?.x ?? null,
        y: at?.y ?? null,
        body,
        assignedToId,
        parentId: parentId ?? null,
      });
      if (!result.ok) {
        setError(result.error);
        return false;
      }
      // A reply belongs inside its thread, not at the end of the list.
      setComments((prev) =>
        result.comment.parentId
          ? prev.map((c) =>
              c.id === result.comment.parentId
                ? { ...c, replies: [...c.replies, result.comment] }
                : c,
            )
          : [...prev, result.comment],
      );
      setPendingPin(null);
      router.refresh();
      return true;
    },
    [drawing.id, page, router],
  );

  /* ---------------- derived ---------------- */

  const pageMarkups = useMemo(() => markups.filter((m) => m.page === page), [markups, page]);
  const pagePins = useMemo(
    () => comments.filter((c) => c.page === page && c.x !== null && c.y !== null),
    [comments, page],
  );
  const authors = useMemo(() => {
    const seen = new Map<string, string>();
    for (const m of markups) seen.set(m.authorId ?? "unknown", m.authorName);
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [markups]);
  const openCount = useMemo(
    () => comments.filter((c) => c.status === "OPEN" && !c.parentId).length,
    [comments],
  );

  const zoomBy = (direction: 1 | -1) => {
    const index = ZOOM_STEPS.findIndex((z) => z >= zoom);
    const next = ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, index + direction))];
    setZoom(next ?? zoom);
  };

  const fitWidth = useCallback(
    (current: PageView | null = view) => {
      const box = scrollRef.current?.clientWidth ?? 0;
      if (!current || box <= 0) return;
      // `widthPx` is the page at the CURRENT zoom, so divide it back out before
      // working out the zoom that would fill the box.
      const pageWidthAtOne = current.widthPx / zoom;
      if (pageWidthAtOne <= 0) return;
      setZoom(Math.max(0.1, Math.min(4, (box - 32) / pageWidthAtOne)));
    },
    [view, zoom],
  );

  /**
   * An A1 sheet at 100% is 2384 px wide — three screens of horizontal scroll
   * before the reviewer has seen anything. The first render fits it to the
   * pane; every zoom after that is theirs.
   */
  const onView = useCallback(
    (next: PageView) => {
      setView(next);
      if (!fittedRef.current) {
        fittedRef.current = true;
        fitWidth(next);
      }
    },
    [fitWidth],
  );

  const finishCalibration = (lengthPt: number) => {
    setCalibrating(false);
    if (lengthPt <= 0) return;
    const answer = window.prompt(
      "How long is that line in real millimetres?\n(e.g. 8000 for an 8 m grid)",
    );
    const mm = Number(answer?.replace(/[^\d.]/g, ""));
    const mmPerPoint = calibrationFrom(lengthPt, mm);
    if (!mmPerPoint) return;
    setCalibration({ mmPerPoint, reference: `${Math.round(mm)} mm` });
  };

  const isPdf = drawing.fileType === "PDF";

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/projects/${drawing.projectId}/drawings`}
            className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
          >
            <ArrowLeft className="h-4 w-4" />
            {drawing.projectNumber} · {drawing.projectName}
          </Link>
          <h2 className="mt-1 flex flex-wrap items-center gap-2 text-xl font-semibold text-fg">
            <span className="font-mono text-base text-faint">{drawing.code}</span>
            {drawing.title}
            <Badge tone="neutral">Rev {drawing.revision}</Badge>
            {drawing.paperSize ? <Badge tone="slate">{drawing.paperSize}</Badge> : null}
            {openCount > 0 ? <Badge tone="amber">{openCount} open</Badge> : null}
          </h2>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-600/30 bg-red-600/5 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="overflow-hidden">
          <Toolbar
            tool={tool}
            setTool={(t) => {
              setTool(t);
              setCommentMode(false);
              setCalibrating(false);
            }}
            colour={colour}
            setColour={setColour}
            strokeWidth={strokeWidth}
            setStrokeWidth={setStrokeWidth}
            stamp={stamp}
            setStamp={setStamp}
            commentMode={commentMode}
            toggleComment={() => {
              setCommentMode((v) => !v);
              setTool(null);
              setCalibrating(false);
            }}
            calibrating={calibrating}
            startCalibration={() => {
              setCalibrating(true);
              setTool(null);
              setCommentMode(false);
            }}
            calibration={calibration}
            onClearMine={clearMine}
            authors={authors}
            hiddenAuthors={hiddenAuthors}
            toggleAuthor={(id) =>
              setHiddenAuthors((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]))
            }
          />

          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 text-sm">
            <div className="flex items-center gap-1">
              <IconButton label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft className="h-4 w-4" />
              </IconButton>
              <span className="px-1 tabular-nums text-muted">
                Page {page} of {pageCount}
              </span>
              <IconButton
                label="Next page"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </IconButton>
            </div>
            <div className="flex items-center gap-1">
              <IconButton label="Zoom out" onClick={() => zoomBy(-1)}>
                <ZoomOut className="h-4 w-4" />
              </IconButton>
              <span className="w-12 text-center tabular-nums text-muted">{Math.round(zoom * 100)}%</span>
              <IconButton label="Zoom in" onClick={() => zoomBy(1)}>
                <ZoomIn className="h-4 w-4" />
              </IconButton>
              <IconButton label="Fit to width" onClick={() => fitWidth()}>
                <Maximize2 className="h-4 w-4" />
              </IconButton>
            </div>
          </div>

          <div ref={scrollRef} className="max-h-[calc(100vh-20rem)] overflow-auto bg-surface-2 p-4">
            {!isPdf ? (
              <p className="py-16 text-center text-sm text-muted">
                This is a {drawing.fileType} file. Only PDFs can be opened here — download it from
                the register instead.
              </p>
            ) : loadError ? (
              <p className="py-16 text-center text-sm text-red-600">{loadError}</p>
            ) : !bytes ? (
              <p className="py-16 text-center text-sm text-muted">Opening the drawing…</p>
            ) : (
              <div className="relative mx-auto w-fit">
                <PdfPageCanvas
                  data={bytes}
                  page={page}
                  zoom={zoom}
                  onDocument={({ pageCount: n }) => setPageCount(n)}
                  onView={onView}
                  onError={setLoadError}
                />
                {view ? (
                  <>
                    <MarkupLayer
                      view={view}
                      markups={pageMarkups}
                      tool={tool}
                      colour={colour}
                      strokeWidth={strokeWidth}
                      stamp={stamp}
                      calibration={calibration}
                      hiddenAuthors={hiddenAuthors}
                      onCreate={onCreate}
                      onSelect={(m) => setSelectedId(m?.id ?? null)}
                      selectedId={selectedId}
                      commentMode={commentMode}
                      onPinComment={onPinComment}
                      calibrating={calibrating}
                      onCalibrate={finishCalibration}
                    />
                    <CommentPins comments={pagePins} view={view} onOpen={(id) => setSelectedId(id)} />
                  </>
                ) : null}
              </div>
            )}
          </div>

          {selectedId && markups.some((m) => m.id === selectedId && m.canDelete) ? (
            <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-sm">
              <span className="text-muted">
                {markups.find((m) => m.id === selectedId)?.authorName}&apos;s mark selected
              </span>
              <button
                type="button"
                onClick={() => onDelete(selectedId)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs text-muted hover:bg-surface-2 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete it
              </button>
            </div>
          ) : null}
        </Card>

        <CommentPanel
          comments={comments}
          team={team}
          page={page}
          pendingPin={pendingPin}
          onCancelPin={() => setPendingPin(null)}
          onAdd={addNote}
          onChanged={refresh}
          currentUserId={currentUser.id}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Toolbar
 * ------------------------------------------------------------------ */

function Toolbar({
  tool,
  setTool,
  colour,
  setColour,
  strokeWidth,
  setStrokeWidth,
  stamp,
  setStamp,
  commentMode,
  toggleComment,
  calibrating,
  startCalibration,
  calibration,
  onClearMine,
  authors,
  hiddenAuthors,
  toggleAuthor,
}: {
  tool: Tool;
  setTool: (t: Tool) => void;
  colour: string;
  setColour: (c: string) => void;
  strokeWidth: number;
  setStrokeWidth: (w: number) => void;
  stamp: string;
  setStamp: (s: string) => void;
  commentMode: boolean;
  toggleComment: () => void;
  calibrating: boolean;
  startCalibration: () => void;
  calibration: Calibration | null;
  onClearMine: () => void;
  authors: { id: string; name: string }[];
  hiddenAuthors: string[];
  toggleAuthor: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-3 py-2">
      <div className="flex flex-wrap items-center gap-1">
        {TOOLS.map(({ tool: t, icon: Icon, label }) => (
          <button
            key={label}
            type="button"
            onClick={() => setTool(t)}
            aria-label={label}
            title={label}
            aria-pressed={tool === t && !commentMode && !calibrating}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-lg border text-muted transition-colors",
              tool === t && !commentMode && !calibrating
                ? "border-brand bg-brand/10 text-brand"
                : "border-transparent hover:bg-surface-2 hover:text-fg",
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}

        <span className="mx-1 h-5 w-px bg-border" />

        <button
          type="button"
          onClick={toggleComment}
          aria-pressed={commentMode}
          title="Pin a comment"
          className={cn(
            "grid h-8 w-8 place-items-center rounded-lg border transition-colors",
            commentMode ? "border-brand bg-brand/10 text-brand" : "border-transparent text-muted hover:bg-surface-2",
          )}
        >
          <MessageSquarePlus className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={startCalibration}
          aria-pressed={calibrating}
          title={
            calibration
              ? `Calibrated against ${calibration.reference} — click to redo`
              : "Calibrate: drag along a known dimension, then type what it is"
          }
          className={cn(
            "grid h-8 w-8 place-items-center rounded-lg border transition-colors",
            calibrating
              ? "border-brand bg-brand/10 text-brand"
              : calibration
                ? "border-transparent text-green-600 hover:bg-surface-2"
                : "border-transparent text-muted hover:bg-surface-2",
          )}
        >
          {calibration ? <Check className="h-4 w-4" /> : <Ruler className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={onClearMine}
          title="Clear my marks on this page"
          className="grid h-8 w-8 place-items-center rounded-lg border border-transparent text-muted transition-colors hover:bg-surface-2 hover:text-red-600"
        >
          <Eraser className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-1">
        {MARKUP_COLOURS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColour(c)}
            aria-label={`Colour ${c}`}
            className={cn(
              "h-5 w-5 rounded-full border-2 transition-transform",
              colour === c ? "scale-110 border-fg" : "border-transparent",
            )}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      <label className="flex items-center gap-2 text-xs text-muted">
        Weight
        <input
          type="range"
          min={1}
          max={8}
          step={0.5}
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(Number(e.target.value))}
          className="h-1 w-24 accent-[var(--color-brand)]"
        />
      </label>

      {tool === "STAMP" ? (
        <select
          value={stamp}
          onChange={(e) => setStamp(e.target.value)}
          aria-label="Stamp"
          className="h-8 rounded-lg border border-border bg-surface px-2 text-xs text-fg"
        >
          {STAMPS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      ) : null}

      {authors.length > 1 ? (
        <div className="flex items-center gap-1 text-xs text-muted">
          <span className="text-[11px] uppercase tracking-wide text-faint">Show</span>
          {authors.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => toggleAuthor(a.id)}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                hiddenAuthors.includes(a.id)
                  ? "border-border text-faint line-through"
                  : "border-brand/40 bg-brand/5 text-fg",
              )}
            >
              {a.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/** The dots that say "there is a comment about this spot". */
function CommentPins({
  comments,
  view,
  onOpen,
}: {
  comments: CommentDTO[];
  view: PageView;
  onOpen: (id: string) => void;
}) {
  return (
    <>
      {comments.map((c, i) => {
        const x = ((c.x ?? 0) / view.widthPt) * view.widthPx;
        const y = view.heightPx - ((c.y ?? 0) / view.heightPt) * view.heightPx;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onOpen(c.id)}
            title={c.body}
            aria-label={`Comment by ${c.authorName}`}
            className={cn(
              "absolute z-10 -translate-x-1/2 -translate-y-full rounded-full px-2 py-0.5 text-[11px] font-semibold text-white shadow",
              c.status === "RESOLVED" ? "bg-green-600/80" : "bg-amber-500",
            )}
            style={{ left: x, top: y }}
          >
            {i + 1}
          </button>
        );
      })}
    </>
  );
}
