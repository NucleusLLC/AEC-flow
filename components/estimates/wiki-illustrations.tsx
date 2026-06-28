/**
 * Built-in SVG illustrations for Estimating Wiki articles.
 *
 * Each article may carry an `illoKey` (see lib/data/estimating-wiki.ts) that
 * selects one of the schematic diagrams below. User-uploaded illustrations
 * (article.image, a data URL) take precedence and are rendered by wiki-view.tsx;
 * these are the fallback "house" diagrams for the seeded reference articles.
 *
 * Diagrams are intentionally schematic (not photoreal) — they read at a glance
 * in a small card and stay crisp at any zoom.
 */

import type { ReactNode, ReactElement } from "react";

const C = {
  concrete: "#cbd5e1",
  concreteEdge: "#94a3b8",
  steel: "#64748b",
  rebar: "#dc2626",
  foam: "#f8fafc",
  ink: "#475569",
  faint: "#94a3b8",
  brand: "#2563eb",
};

function Frame({ children, viewBox = "0 0 320 180", label }: { children: ReactNode; viewBox?: string; label?: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface-2">
      <svg viewBox={viewBox} role="img" aria-label={label} className="block h-auto w-full">
        {children}
      </svg>
    </div>
  );
}

const tx = { fontFamily: "ui-sans-serif, system-ui, sans-serif" } as const;

/** A horizontal rebar mesh (dots = bars cut in section, line = bar in plane). */
function meshRow(y: number, x0: number, x1: number, n: number, color = C.rebar) {
  const step = (x1 - x0) / (n - 1);
  return (
    <g>
      <line x1={x0} y1={y} x2={x1} y2={y} stroke={color} strokeWidth={1.4} />
      {Array.from({ length: n }, (_, i) => (
        <circle key={i} cx={x0 + i * step} cy={y} r={2.4} fill={color} />
      ))}
    </g>
  );
}

/* ───────────────────────── individual diagrams ───────────────────────── */

function SlabTypes() {
  // Four stacked slab systems, mirroring the structural reference sheet.
  const rows = [
    { n: "1", title: "Typical RC slab (solid)", w: "4.5–6.0 kN/m²" },
    { n: "2", title: "Metal-deck composite", w: "2.7–3.33 kN/m²" },
    { n: "3", title: "EMMEDUE PSF100 panel", w: "2.12–2.71 kN/m²" },
    { n: "4", title: "Bubble-deck (voided)", w: "3.9–4.5 kN/m²" },
  ];
  const rh = 92;
  const sx = 16;
  const dw = 168; // diagram width
  return (
    <Frame viewBox={`0 0 360 ${rh * 4}`} label="Types of reinforced concrete slab">
      <rect x={0} y={0} width={360} height={rh * 4} fill="#ffffff" />
      {rows.map((r, i) => {
        const top = i * rh + 14;
        const slabT = 30;
        const cy = top + 22;
        return (
          <g key={r.n}>
            {/* number badge */}
            <circle cx={sx + 6} cy={cy + 4} r={11} fill="none" stroke={C.rebar} strokeWidth={1.6} />
            <text x={sx + 6} y={cy + 8} textAnchor="middle" fontSize={12} fontWeight={700} fill={C.rebar} style={tx}>{r.n}</text>

            {/* slab body */}
            <g transform={`translate(${sx + 26}, ${top})`}>
              {i === 0 && (
                <g>
                  <rect x={0} y={4} width={dw} height={slabT} fill={C.concrete} stroke={C.concreteEdge} strokeWidth={1.2} />
                  {meshRow(4 + slabT - 8, 10, dw - 10, 9)}
                  {Array.from({ length: 9 }, (_, k) => (
                    <line key={k} x1={10 + k * ((dw - 20) / 8)} y1={4 + slabT - 14} x2={10 + k * ((dw - 20) / 8)} y2={4 + slabT - 2} stroke={C.rebar} strokeWidth={1} />
                  ))}
                </g>
              )}
              {i === 1 && (
                <g>
                  {/* concrete topping */}
                  <rect x={0} y={4} width={dw} height={16} fill={C.concrete} stroke={C.concreteEdge} strokeWidth={1.2} />
                  {meshRow(11, 10, dw - 10, 9, C.rebar)}
                  {/* corrugated steel deck */}
                  <path
                    d={`M0 20 ${Array.from({ length: 6 }, (_, k) => `L${k * (dw / 6)} 20 L${k * (dw / 6) + dw / 12} 34 L${(k + 1) * (dw / 6)} 34 L${(k + 1) * (dw / 6)} 20`).join(" ")} `}
                    fill="none"
                    stroke={C.steel}
                    strokeWidth={1.8}
                  />
                </g>
              )}
              {i === 2 && (
                <g>
                  {/* concrete skins top & bottom, foam core (60% efficient) */}
                  <rect x={0} y={4} width={dw} height={8} fill={C.concrete} stroke={C.concreteEdge} strokeWidth={1} />
                  <rect x={0} y={12} width={dw} height={18} fill={C.foam} stroke={C.faint} strokeWidth={1} />
                  <rect x={0} y={30} width={dw} height={8} fill={C.concrete} stroke={C.concreteEdge} strokeWidth={1} />
                  {/* truss mesh through core */}
                  <path d={`M6 30 ${Array.from({ length: 11 }, (_, k) => `L${6 + k * ((dw - 12) / 10)} ${k % 2 ? 13 : 30}`).join(" ")}`} fill="none" stroke={C.rebar} strokeWidth={1} />
                </g>
              )}
              {i === 3 && (
                <g>
                  {/* voided slab with hollow spheres */}
                  <rect x={0} y={4} width={dw} height={34} fill={C.concrete} stroke={C.concreteEdge} strokeWidth={1.2} />
                  {meshRow(10, 10, dw - 10, 9, C.rebar)}
                  {meshRow(34, 10, dw - 10, 9, C.rebar)}
                  {Array.from({ length: 6 }, (_, k) => (
                    <circle key={k} cx={18 + k * ((dw - 36) / 5)} cy={22} r={9} fill="#fde68a" stroke="#f59e0b" strokeWidth={1.1} />
                  ))}
                </g>
              )}
            </g>

            {/* labels */}
            <text x={sx + 26} y={top + 52} fontSize={11} fontWeight={600} fill={C.ink} style={tx}>{r.title}</text>
            <text x={360 - 14} y={top + 26} textAnchor="end" fontSize={12} fontWeight={700} fill={C.rebar} style={tx}>{r.w}</text>
            {i < 3 && <line x1={12} y1={top + 64} x2={348} y2={top + 64} stroke="#e2e8f0" strokeWidth={1} />}
          </g>
        );
      })}
    </Frame>
  );
}

function Paint() {
  return (
    <Frame label="Paint coverage per litre">
      <rect x={0} y={0} width={320} height={180} fill="#ffffff" />
      {/* wall */}
      <rect x={24} y={28} width={210} height={124} fill="#eef2ff" stroke={C.concreteEdge} strokeWidth={1.2} />
      {/* painted portion */}
      <rect x={24} y={28} width={120} height={124} fill="#c7d2fe" />
      {/* coverage arrow */}
      <line x1={24} y1={166} x2={144} y2={166} stroke={C.brand} strokeWidth={1.4} markerEnd="" />
      <text x={84} y={178} textAnchor="middle" fontSize={11} fill={C.brand} style={tx}>≈ 10–12 m² / L</text>
      {/* roller */}
      <rect x={150} y={20} width={46} height={16} rx={3} fill={C.ink} />
      <rect x={170} y={36} width={4} height={30} fill={C.ink} />
      <rect x={196} y={24} width={6} height={8} fill={C.faint} />
      <text x={258} y={70} fontSize={11} fontWeight={600} fill={C.ink} style={tx}>Smooth</text>
      <text x={258} y={86} fontSize={11} fill={C.faint} style={tx}>2 coats</text>
    </Frame>
  );
}

function Icf() {
  return (
    <Frame label="ICF form with concrete core">
      <rect x={0} y={0} width={320} height={180} fill="#ffffff" />
      {/* outer foam */}
      <rect x={40} y={30} width={240} height={120} fill={C.foam} stroke={C.faint} strokeWidth={1.4} />
      {/* concrete core */}
      <rect x={40} y={66} width={240} height={48} fill={C.concrete} stroke={C.concreteEdge} strokeWidth={1.2} />
      {/* rebar in core */}
      <line x1={50} y1={90} x2={270} y2={90} stroke={C.rebar} strokeWidth={1.4} />
      {Array.from({ length: 9 }, (_, k) => <circle key={k} cx={60 + k * 26} cy={90} r={2.6} fill={C.rebar} />)}
      {/* webs */}
      {Array.from({ length: 5 }, (_, k) => <line key={k} x1={70 + k * 48} y1={30} x2={70 + k * 48} y2={150} stroke="#e2e8f0" strokeWidth={1} />)}
      <text x={160} y={22} textAnchor="middle" fontSize={11} fontWeight={600} fill={C.ink} style={tx}>ICF form ≈ 1.22 × 0.30 m</text>
      <text x={160} y={168} textAnchor="middle" fontSize={11} fill={C.faint} style={tx}>core fill ≈ 0.16 m³ / m² (200 mm)</text>
    </Frame>
  );
}

function Block() {
  return (
    <Frame label="Concrete block wall, running bond">
      <rect x={0} y={0} width={320} height={180} fill="#ffffff" />
      {Array.from({ length: 5 }, (_, row) => {
        const y = 30 + row * 24;
        const offset = row % 2 ? -30 : 0;
        return Array.from({ length: 5 }, (_, col) => (
          <rect key={`${row}-${col}`} x={30 + offset + col * 52} y={y} width={48} height={20} fill={C.concrete} stroke={C.concreteEdge} strokeWidth={1.2} />
        ));
      })}
      <text x={160} y={168} textAnchor="middle" fontSize={11} fill={C.faint} style={tx}>12.5 blocks / m² (400 × 200 face)</text>
    </Frame>
  );
}

function Plaster() {
  return (
    <Frame label="Plaster build-up on masonry">
      <rect x={0} y={0} width={320} height={180} fill="#ffffff" />
      {/* masonry */}
      <rect x={40} y={30} width={120} height={120} fill={C.concrete} stroke={C.concreteEdge} strokeWidth={1.2} />
      {/* scratch coat */}
      <rect x={160} y={30} width={18} height={120} fill="#e2e8f0" stroke={C.faint} strokeWidth={1} />
      {/* finish coat */}
      <rect x={178} y={30} width={10} height={120} fill="#f1f5f9" stroke={C.faint} strokeWidth={1} />
      {/* dim line */}
      <line x1={160} y1={158} x2={188} y2={158} stroke={C.ink} strokeWidth={1} />
      <text x={232} y={70} fontSize={11} fontWeight={600} fill={C.ink} style={tx}>12–15 mm</text>
      <text x={232} y={86} fontSize={11} fill={C.faint} style={tx}>2 coats · 1:4–1:6</text>
      <text x={100} y={24} textAnchor="middle" fontSize={11} fill={C.faint} style={tx}>masonry</text>
    </Frame>
  );
}

function Rebar() {
  return (
    <Frame label="Reinforcement density in concrete">
      <rect x={0} y={0} width={320} height={180} fill="#ffffff" />
      <rect x={36} y={30} width={248} height={120} fill={C.concrete} stroke={C.concreteEdge} strokeWidth={1.2} />
      {/* rebar grid */}
      {Array.from({ length: 4 }, (_, r) => meshRow(50 + r * 30, 50, 270, 11)).map((g, i) => <g key={i}>{g}</g>)}
      {Array.from({ length: 11 }, (_, k) => <line key={k} x1={50 + k * 22} y1={48} x2={50 + k * 22} y2={142} stroke={C.rebar} strokeWidth={0.8} opacity={0.5} />)}
      <text x={160} y={170} textAnchor="middle" fontSize={11} fill={C.faint} style={tx}>kg ÷ m³ — column 150–250 · slab 90–130</text>
    </Frame>
  );
}

function Tiling() {
  return (
    <Frame label="Tile layout with adhesive">
      <rect x={0} y={0} width={320} height={180} fill="#ffffff" />
      {Array.from({ length: 4 }, (_, r) =>
        Array.from({ length: 6 }, (_, c) => (
          <rect key={`${r}-${c}`} x={34 + c * 42} y={28 + r * 30} width={38} height={26} rx={2} fill="#e0f2fe" stroke="#7dd3fc" strokeWidth={1.2} />
        )),
      )}
      <text x={160} y={168} textAnchor="middle" fontSize={11} fill={C.faint} style={tx}>adhesive ≈ 4 kg/m² · waste 8–10%</text>
    </Frame>
  );
}

function Concrete() {
  return (
    <Frame label="Concrete volume & wastage">
      <rect x={0} y={0} width={320} height={180} fill="#ffffff" />
      {/* a cube in iso */}
      <polygon points="90,60 170,60 200,90 120,90" fill="#e2e8f0" stroke={C.concreteEdge} strokeWidth={1.2} />
      <polygon points="90,60 120,90 120,150 90,120" fill={C.concrete} stroke={C.concreteEdge} strokeWidth={1.2} />
      <polygon points="120,90 200,90 200,150 120,150" fill={C.concreteEdge} stroke={C.steel} strokeWidth={1.2} />
      <text x={232} y={96} fontSize={12} fontWeight={700} fill={C.rebar} style={tx}>+3–5%</text>
      <text x={232} y={114} fontSize={11} fill={C.faint} style={tx}>wastage</text>
      <text x={232} y={134} fontSize={11} fill={C.faint} style={tx}>bulking +25–30%</text>
    </Frame>
  );
}

function Labor() {
  return (
    <Frame label="Labour productivity norm">
      <rect x={0} y={0} width={320} height={180} fill="#ffffff" />
      {/* hard hat */}
      <path d="M70 110 a45 45 0 0 1 90 0 z" fill="#facc15" stroke="#ca8a04" strokeWidth={1.4} />
      <rect x={58} y={110} width={114} height={10} rx={3} fill="#eab308" stroke="#ca8a04" strokeWidth={1.2} />
      <rect x={108} y={62} width={14} height={20} rx={3} fill="#eab308" />
      {/* clock */}
      <circle cx={236} cy={92} r={36} fill="#ffffff" stroke={C.ink} strokeWidth={1.8} />
      <line x1={236} y1={92} x2={236} y2={66} stroke={C.ink} strokeWidth={2} />
      <line x1={236} y1={92} x2={256} y2={100} stroke={C.ink} strokeWidth={2} />
      <text x={160} y={166} textAnchor="middle" fontSize={11} fill={C.faint} style={tx}>Norm Hrs/Unit × Qty = total crew-hours</text>
    </Frame>
  );
}

function Markup() {
  return (
    <Frame label="Cost build-up with mark-ups">
      <rect x={0} y={0} width={320} height={180} fill="#ffffff" />
      {/* stacked bar */}
      <rect x={70} y={120} width={70} height={34} fill={C.concrete} stroke={C.concreteEdge} strokeWidth={1} />
      <rect x={70} y={96} width={70} height={24} fill="#bfdbfe" stroke="#60a5fa" strokeWidth={1} />
      <rect x={70} y={76} width={70} height={20} fill="#bbf7d0" stroke="#4ade80" strokeWidth={1} />
      <rect x={70} y={60} width={70} height={16} fill="#fde68a" stroke="#f59e0b" strokeWidth={1} />
      <text x={150} y={142} fontSize={11} fill={C.ink} style={tx}>Direct cost</text>
      <text x={150} y={112} fontSize={11} fill="#2563eb" style={tx}>+ Preliminaries 8–15%</text>
      <text x={150} y={90} fontSize={11} fill="#16a34a" style={tx}>+ Profit 10–25%</text>
      <text x={150} y={72} fontSize={11} fill="#b45309" style={tx}>+ BBO (turnover tax) 5–10%</text>
    </Frame>
  );
}

function Waterproof() {
  return (
    <Frame label="Waterproofing membrane layers">
      <rect x={0} y={0} width={320} height={180} fill="#ffffff" />
      {/* substrate */}
      <rect x={30} y={104} width={260} height={40} fill={C.concrete} stroke={C.concreteEdge} strokeWidth={1.2} />
      {/* membrane */}
      <rect x={30} y={92} width={260} height={12} fill="#1e293b" />
      {/* protection screed */}
      <rect x={30} y={74} width={260} height={18} fill="#e2e8f0" stroke={C.faint} strokeWidth={1} />
      {/* overlap marker */}
      <line x1={150} y1={86} x2={180} y2={86} stroke="#f87171" strokeWidth={3} />
      <text x={165} y={66} textAnchor="middle" fontSize={10} fill={C.rebar} style={tx}>overlap 100/150 mm</text>
      <text x={160} y={166} textAnchor="middle" fontSize={11} fill={C.faint} style={tx}>membrane · waste 10–12% · screed 40–50 mm</text>
    </Frame>
  );
}

const MAP: Record<string, () => ReactElement> = {
  "slab-types": SlabTypes,
  paint: Paint,
  icf: Icf,
  block: Block,
  plaster: Plaster,
  rebar: Rebar,
  tiling: Tiling,
  concrete: Concrete,
  labor: Labor,
  markup: Markup,
  waterproof: Waterproof,
};

export const WIKI_ILLO_KEYS = Object.keys(MAP);

export function WikiIllustration({ kind }: { kind: string }) {
  const Cmp = MAP[kind];
  return Cmp ? <Cmp /> : null;
}
