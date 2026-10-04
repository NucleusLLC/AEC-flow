"use client";

/* eslint-disable @next/next/no-img-element -- data URL preview */
import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/i18n/language-provider";
import { COVER_FRAMES, ZOOM_MAX, ZOOM_MIN, frameRatio, panCoverFit, type CoverFit } from "@/lib/estimates/cover-fit";
import { CroppedImage } from "./cover-image-frame";

/**
 * Cover image framing in the Print Control panel: pick the frame (the image's
 * own proportions, or a fixed ratio), then drag and zoom to choose the crop.
 * The preview uses the same geometry as the printed cover page.
 *
 * A drag only updates a local draft; the estimate gets the result on release,
 * so the whole sheet doesn't re-render (and autosave) on every pointer move.
 */
export function CoverFitControls({ image, fit, onChange }: { image: string; fit: CoverFit; onChange: (v: CoverFit) => void }) {
  const t = useT();
  const [draft, setDraft] = useState<CoverFit | null>(null);
  const view = draft ?? fit;
  const fr = frameRatio(view.frame);
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; fit: CoverFit } | null>(null);

  // Images saved before the ratio was recorded: measure once so the crop maths can run.
  useEffect(() => {
    if (fit.imageRatio) return;
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) onChange({ ...fit, imageRatio: img.naturalWidth / img.naturalHeight });
    };
    img.src = image;
  }, [image, fit, onChange]);

  const pan = (base: CoverFit, dx: number, dy: number) => {
    const el = frameRef.current;
    if (!el || !base.imageRatio) return base;
    const r = el.getBoundingClientRect();
    return panCoverFit(base, dx, dy, r.width, r.height, base.imageRatio);
  };

  return (
    <div className="space-y-1.5">
      <div>
        <div className="mb-1 text-[11px] font-medium text-muted">{t("Image frame")}</div>
        <div className="flex overflow-hidden rounded-md border border-border" role="group" aria-label={t("Image frame")}>
          {COVER_FRAMES.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={view.frame === f}
              onClick={() => onChange({ ...fit, frame: f })}
              className={`flex-1 px-1 py-1 text-[11px] font-medium tabular-nums transition-colors ${view.frame === f ? "bg-brand text-brand-fg" : "bg-surface text-muted hover:text-fg"}`}
            >
              {f === "original" ? t("Original") : f}
            </button>
          ))}
        </div>
      </div>

      {fr == null ? (
        <>
          <img src={image} alt={t("Cover")} className="max-h-40 w-full rounded-md border border-border bg-surface-2 object-contain" />
          <div className="text-[10px] text-faint">{t("Whole image, no crop")}</div>
        </>
      ) : (
        <>
          <div
            ref={frameRef}
            tabIndex={0}
            role="img"
            aria-label={t("Drag the image to choose what stays in frame")}
            title={t("Drag the image to choose what stays in frame")}
            className="relative w-full cursor-grab touch-none select-none overflow-hidden rounded-md border border-border bg-surface-2 outline-none focus-visible:ring-2 focus-visible:ring-brand active:cursor-grabbing"
            style={{ aspectRatio: String(fr) }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = { x: e.clientX, y: e.clientY, fit };
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d) return;
              setDraft(pan(d.fit, e.clientX - d.x, e.clientY - d.y));
            }}
            onPointerUp={() => {
              drag.current = null;
              if (draft) onChange(draft);
              setDraft(null);
            }}
            onPointerCancel={() => {
              drag.current = null;
              setDraft(null);
            }}
            onKeyDown={(e) => {
              const step = 8;
              const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
              const m = moves[e.key];
              if (!m) return;
              e.preventDefault();
              onChange(pan(fit, m[0], m[1]));
            }}
          >
            <CroppedImage image={image} fit={view} alt={t("Cover")} />
          </div>
          <div className="text-[10px] text-faint">{t("Drag the image to choose what stays in frame")}</div>
          <div className="flex items-center gap-2">
            <label htmlFor="cover-zoom" className="text-[11px] font-medium text-muted">{t("Zoom")}</label>
            <input
              id="cover-zoom"
              type="range"
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={0.05}
              value={view.zoom}
              onChange={(e) => onChange({ ...fit, zoom: Number(e.target.value) })}
              className="min-w-0 flex-1 accent-brand"
            />
            <span className="w-9 text-right text-[11px] tabular-nums text-muted">{view.zoom.toFixed(1)}×</span>
            <button
              type="button"
              onClick={() => onChange({ ...fit, x: 50, y: 50, zoom: 1 })}
              className="rounded-md border border-border bg-surface px-1.5 py-0.5 text-[11px] font-medium text-fg hover:bg-surface-2"
            >
              {t("Reset crop")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
