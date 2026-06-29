"use client";

import { useMemo, useRef, useState } from "react";
import { Upload, Printer, Trash2, X } from "lucide-react";

type Photo = { id: string; url: string; caption: string };

const PAPERS = { A4: [210, 297], A3: [297, 420] } as const;
type Paper = keyof typeof PAPERS;

let pid = 0;
const nid = () => `ph${++pid}-${Math.floor(performance.now())}`;

/**
 * Photo contact-sheet builder — upload site photos, lay them out on A4/A3 sheets
 * in a configurable grid (default 2 columns × 5 rows), then print or Save-as-PDF.
 * Client-side only (data URLs); persistence comes with the storage layer.
 */
export function PhotoContactSheet() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [cols, setCols] = useState(2);
  const [rows, setRows] = useState(5);
  const [paper, setPaper] = useState<Paper>("A4");
  const [landscape, setLandscape] = useState(false);
  const [title, setTitle] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const perPage = Math.max(1, cols * rows);
  const pages = useMemo(() => {
    const out: Photo[][] = [];
    for (let i = 0; i < photos.length; i += perPage) out.push(photos.slice(i, i + perPage));
    return out.length ? out : [[]];
  }, [photos, perPage]);

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => {
      if (!f.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () =>
        setPhotos((p) => [...p, { id: nid(), url: String(reader.result), caption: f.name.replace(/\.[^.]+$/, "") }]);
      reader.readAsDataURL(f);
    });
  };

  const removePhoto = (id: string) => setPhotos((p) => p.filter((x) => x.id !== id));
  const setCaption = (id: string, caption: string) =>
    setPhotos((p) => p.map((x) => (x.id === id ? { ...x, caption } : x)));

  const [baseW, baseH] = PAPERS[paper];
  const [pw, ph] = landscape ? [baseH, baseW] : [baseW, baseH];

  return (
    <div className="space-y-4">
      <style>{`@media print {
        body * { visibility: hidden !important; }
        .cs-print, .cs-print * { visibility: visible !important; }
        .cs-print { position: absolute; left: 0; top: 0; width: 100%; }
        .cs-page { page-break-after: always; box-shadow: none !important; }
        @page { size: ${pw}mm ${ph}mm; margin: 8mm; }
      }`}</style>

      {/* Controls */}
      <div className="cs-controls flex flex-wrap items-end gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-4">
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => { onFiles(e.target.files); if (fileRef.current) fileRef.current.value = ""; }} />
        <button type="button" onClick={() => fileRef.current?.click()}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg hover:bg-brand/90">
          <Upload className="h-4 w-4" /> Add photos
        </button>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Sheet title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Site photos — Project / date"
            className="h-9 w-64 rounded-lg border border-border bg-surface px-3 text-sm text-fg outline-none focus:ring-2 focus:ring-brand/20" />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Columns</span>
          <input type="number" min={1} max={6} value={cols} onChange={(e) => setCols(Math.max(1, Math.min(6, Number(e.target.value) || 1)))}
            className="h-9 w-20 rounded-lg border border-border bg-surface px-3 text-sm text-fg outline-none focus:ring-2 focus:ring-brand/20" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Rows</span>
          <input type="number" min={1} max={10} value={rows} onChange={(e) => setRows(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
            className="h-9 w-20 rounded-lg border border-border bg-surface px-3 text-sm text-fg outline-none focus:ring-2 focus:ring-brand/20" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Paper</span>
          <select value={paper} onChange={(e) => setPaper(e.target.value as Paper)}
            className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-fg outline-none focus:ring-2 focus:ring-brand/20">
            <option value="A4">A4</option>
            <option value="A3">A3</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Orientation</span>
          <select value={landscape ? "l" : "p"} onChange={(e) => setLandscape(e.target.value === "l")}
            className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-fg outline-none focus:ring-2 focus:ring-brand/20">
            <option value="p">Portrait</option>
            <option value="l">Landscape</option>
          </select>
        </label>

        <div className="ml-auto flex items-end gap-2">
          {photos.length > 0 ? (
            <button type="button" onClick={() => setPhotos([])}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg">
              <Trash2 className="h-4 w-4" /> Clear
            </button>
          ) : null}
          <button type="button" onClick={() => window.print()} disabled={photos.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
            <Printer className="h-4 w-4" /> Print / Save PDF
          </button>
        </div>
        <p className="w-full text-xs text-faint">
          {photos.length} photo{photos.length === 1 ? "" : "s"} · {cols}×{rows} = {perPage} per {paper} page · {pages.length} page{pages.length === 1 ? "" : "s"}
        </p>
      </div>

      {photos.length === 0 ? (
        <button type="button" onClick={() => fileRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed border-border bg-surface-2/30 py-16 text-muted hover:border-brand/40 hover:text-fg">
          <Upload className="h-6 w-6" />
          <span className="text-sm font-medium">Add site photos to build a contact sheet</span>
          <span className="text-xs text-faint">Default layout: 2 columns × 5 rows on A4</span>
        </button>
      ) : (
        <div className="cs-print space-y-6">
          {pages.map((pagePhotos, pi) => (
            <div key={pi} className="cs-page mx-auto bg-white text-black shadow-lg ring-1 ring-black/5"
              style={{ width: `min(100%, ${pw * 2.4}px)`, aspectRatio: `${pw} / ${ph}`, padding: "4%" }}>
              <div className="flex h-full flex-col">
                {pi === 0 && title ? (
                  <div className="mb-[2%] border-b border-black/20 pb-[1.5%]">
                    <div className="text-[1.6vw] font-bold leading-tight sm:text-sm">{title}</div>
                  </div>
                ) : null}
                <div className="grid flex-1 gap-[2%]"
                  style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}>
                  {Array.from({ length: perPage }).map((_, ci) => {
                    const photo = pagePhotos[ci];
                    return (
                      <div key={ci} className="group relative flex min-h-0 flex-col overflow-hidden rounded-sm border border-black/15">
                        {photo ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photo.url} alt={photo.caption} className="min-h-0 flex-1 w-full object-cover" />
                            <input value={photo.caption} onChange={(e) => setCaption(photo.id, e.target.value)}
                              className="cs-cap shrink-0 border-t border-black/10 bg-white px-1 py-0.5 text-center text-[10px] text-black outline-none" />
                            <button type="button" onClick={() => removePhoto(photo.id)}
                              className="cs-controls absolute right-1 top-1 rounded bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                              aria-label="Remove photo">
                              <X className="h-3 w-3" />
                            </button>
                          </>
                        ) : (
                          <div className="flex-1" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
