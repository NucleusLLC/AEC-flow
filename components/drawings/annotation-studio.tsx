"use client";

import { useCallback, useRef, useState } from "react";
import {
  Pencil, Minus, Square, Circle, Type, MousePointer2,
  Undo2, Trash2, Upload, Printer, Mail,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tool = "select" | "pen" | "line" | "rect" | "circle" | "text";
type Pt = { x: number; y: number };
type Shape =
  | { id: string; type: "pen"; pts: Pt[]; color: string; w: number }
  | { id: string; type: "line"; a: Pt; b: Pt; color: string; w: number }
  | { id: string; type: "rect"; a: Pt; b: Pt; color: string; w: number }
  | { id: string; type: "circle"; a: Pt; b: Pt; color: string; w: number }
  | { id: string; type: "text"; at: Pt; text: string; color: string; size: number };

const COLORS = ["#ef4444", "#2563eb", "#16a34a", "#f59e0b", "#a855f7", "#000000", "#ffffff"];
const PAPERS: Record<string, [number, number]> = { A4: [210, 297], A3: [297, 420], A2: [420, 594], A1: [594, 841] };

const TOOLS: { t: Tool; Icon: LucideIcon; label: string }[] = [
  { t: "select", Icon: MousePointer2, label: "Select" },
  { t: "pen", Icon: Pencil, label: "Pen" },
  { t: "line", Icon: Minus, label: "Line" },
  { t: "rect", Icon: Square, label: "Rectangle" },
  { t: "circle", Icon: Circle, label: "Circle" },
  { t: "text", Icon: Type, label: "Text" },
];

// Fixed annotation coordinate space (matches the canvas viewBox); the background
// image is fit into it and everything scales together on screen and in print.
const CW = 1600;
const CH = 1131; // ~A-series landscape ratio (√2)

let sid = 0;
const nid = () => `s${++sid}-${Math.floor(performance.now())}`;

export function AnnotationStudio() {
  const [bg, setBg] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(4);
  const [fontSize, setFontSize] = useState(28);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [draft, setDraft] = useState<Shape | null>(null);
  const [textInput, setTextInput] = useState<{ at: Pt; value: string } | null>(null);
  const [paper, setPaper] = useState<keyof typeof PAPERS>("A1");
  const [landscape, setLandscape] = useState(true);

  const svgRef = useRef<SVGSVGElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);

  const toCanvas = useCallback((e: React.PointerEvent): Pt => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * CW, y: ((e.clientY - r.top) / r.height) * CH };
  }, []);

  const onDown = (e: React.PointerEvent) => {
    if (tool === "select") return;
    const p = toCanvas(e);
    if (tool === "text") { setTextInput({ at: p, value: "" }); return; }
    drawing.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (tool === "pen") setDraft({ id: nid(), type: "pen", pts: [p], color, w: width });
    else setDraft({ id: nid(), type: tool, a: p, b: p, color, w: width } as Shape);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drawing.current || !draft) return;
    const p = toCanvas(e);
    if (draft.type === "pen") setDraft({ ...draft, pts: [...draft.pts, p] });
    else if (draft.type !== "text") setDraft({ ...draft, b: p });
  };
  const onUp = () => {
    if (draft) setShapes((s) => [...s, draft]);
    setDraft(null);
    drawing.current = false;
  };

  const commitText = () => {
    if (textInput && textInput.value.trim()) {
      setShapes((s) => [...s, { id: nid(), type: "text", at: textInput.at, text: textInput.value, color, size: fontSize }]);
    }
    setTextInput(null);
  };

  const undo = () => setShapes((s) => s.slice(0, -1));
  const clear = () => { setShapes([]); setDraft(null); };

  const onFile = (f: File | undefined) => {
    if (!f || !f.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setBg(String(reader.result));
    reader.readAsDataURL(f);
  };

  const [pw0, ph0] = PAPERS[paper];
  const [pw, ph] = landscape ? [ph0, pw0] : [pw0, ph0];

  const renderShape = (sh: Shape) => {
    switch (sh.type) {
      case "pen":
        return <polyline key={sh.id} points={sh.pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={sh.color} strokeWidth={sh.w} strokeLinecap="round" strokeLinejoin="round" />;
      case "line":
        return <line key={sh.id} x1={sh.a.x} y1={sh.a.y} x2={sh.b.x} y2={sh.b.y} stroke={sh.color} strokeWidth={sh.w} strokeLinecap="round" />;
      case "rect":
        return <rect key={sh.id} x={Math.min(sh.a.x, sh.b.x)} y={Math.min(sh.a.y, sh.b.y)} width={Math.abs(sh.b.x - sh.a.x)} height={Math.abs(sh.b.y - sh.a.y)} fill="none" stroke={sh.color} strokeWidth={sh.w} />;
      case "circle":
        return <ellipse key={sh.id} cx={(sh.a.x + sh.b.x) / 2} cy={(sh.a.y + sh.b.y) / 2} rx={Math.abs(sh.b.x - sh.a.x) / 2} ry={Math.abs(sh.b.y - sh.a.y) / 2} fill="none" stroke={sh.color} strokeWidth={sh.w} />;
      case "text":
        return <text key={sh.id} x={sh.at.x} y={sh.at.y} fill={sh.color} fontSize={sh.size} fontFamily="sans-serif" dominantBaseline="hanging">{sh.text}</text>;
    }
  };

  return (
    <div className="space-y-3">
      <style>{`@media print {
        body * { visibility: hidden !important; }
        .ann-print, .ann-print * { visibility: visible !important; }
        .ann-print { position: absolute; left: 0; top: 0; width: 100%; }
        .ann-sheet { box-shadow: none !important; border: none !important; }
        @page { size: ${pw}mm ${ph}mm; margin: 6mm; }
      }`}</style>

      {/* Toolbar */}
      <div className="ann-controls flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-border bg-surface p-3">
        {TOOLS.map(({ t, Icon, label }) => (
          <button key={t} type="button" onClick={() => setTool(t)} title={label}
            className={cn("inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors",
              tool === t ? "border-brand bg-brand text-white" : "border-border bg-surface text-muted hover:bg-surface-2 hover:text-fg")}>
            <Icon className="h-4 w-4" />
          </button>
        ))}

        <div className="mx-1 h-6 w-px bg-border" />
        <div className="flex items-center gap-1">
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Color ${c}`}
              className={cn("h-6 w-6 rounded-full border", color === c ? "ring-2 ring-brand ring-offset-1" : "border-border")}
              style={{ backgroundColor: c }} />
          ))}
        </div>

        <div className="mx-1 h-6 w-px bg-border" />
        <label className="flex items-center gap-1.5 text-xs text-muted" title="Pen thickness">
          <Pencil className="h-3.5 w-3.5" />
          <input type="range" min={1} max={16} value={width} onChange={(e) => setWidth(Number(e.target.value))} />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted" title="Text size">
          <Type className="h-3.5 w-3.5" />
          <input type="range" min={12} max={72} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} />
        </label>

        <div className="mx-1 h-6 w-px bg-border" />
        <button type="button" onClick={undo} disabled={!shapes.length} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-sm text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-40" title="Undo">
          <Undo2 className="h-4 w-4" />
        </button>
        <button type="button" onClick={clear} disabled={!shapes.length} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-sm text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-40" title="Clear all">
          <Trash2 className="h-4 w-4" />
        </button>

        <div className="ml-auto flex items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); if (fileRef.current) fileRef.current.value = ""; }} />
          <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg hover:bg-surface-2">
            <Upload className="h-4 w-4" /> Drawing
          </button>
          <select value={paper} onChange={(e) => setPaper(e.target.value as keyof typeof PAPERS)} className="h-9 rounded-lg border border-border bg-surface px-2 text-sm text-fg" title="Paper size">
            {Object.keys(PAPERS).map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={landscape ? "l" : "p"} onChange={(e) => setLandscape(e.target.value === "l")} className="h-9 rounded-lg border border-border bg-surface px-2 text-sm text-fg" title="Orientation">
            <option value="l">Landscape</option>
            <option value="p">Portrait</option>
          </select>
          <button type="button" onClick={() => window.print()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700" title={`Print / Save PDF (${paper})`}>
            <Printer className="h-4 w-4" /> Print / PDF
          </button>
          <button type="button" disabled title="Email — available once drawings are stored on the server"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-faint" >
            <Mail className="h-4 w-4" /> Email <span className="text-[10px]">(soon)</span>
          </button>
        </div>
      </div>

      {/* Canvas / paper preview */}
      <div className="ann-print overflow-auto rounded-[var(--radius-card)] border border-border bg-surface-2/30 p-4">
        <div className="ann-sheet relative mx-auto bg-white shadow-lg" style={{ width: `min(100%, ${pw * 3.2}px)`, aspectRatio: `${pw} / ${ph}` }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${CW} ${CH}`}
            preserveAspectRatio="xMidYMid meet"
            className={cn("absolute inset-0 h-full w-full touch-none", tool === "select" ? "cursor-default" : "cursor-crosshair")}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
          >
            {bg ? (
              <image href={bg} x={0} y={0} width={CW} height={CH} preserveAspectRatio="xMidYMid meet" />
            ) : (
              <>
                <rect x={0} y={0} width={CW} height={CH} fill="#ffffff" />
                <text x={CW / 2} y={CH / 2} textAnchor="middle" fill="#94a3b8" fontSize={30} fontFamily="sans-serif">
                  Upload a drawing to annotate, or start drawing on the blank sheet
                </text>
              </>
            )}
            {shapes.map(renderShape)}
            {draft ? renderShape(draft) : null}
          </svg>

          {/* Inline text entry */}
          {textInput ? (
            <input
              autoFocus
              value={textInput.value}
              onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
              onBlur={commitText}
              onKeyDown={(e) => { if (e.key === "Enter") commitText(); if (e.key === "Escape") setTextInput(null); }}
              className="ann-controls absolute z-10 rounded border border-brand bg-white px-1 text-black outline-none"
              style={{
                left: `${(textInput.at.x / CW) * 100}%`,
                top: `${(textInput.at.y / CH) * 100}%`,
                fontSize: 16,
                color,
              }}
              placeholder="Type…"
            />
          ) : null}
        </div>
      </div>
      <p className="ann-controls text-[11px] text-faint">
        Tip: pick a tool, draw on the sheet, then Print / Save PDF at A1–A4. The preview shows the true plot layout.
      </p>
    </div>
  );
}
